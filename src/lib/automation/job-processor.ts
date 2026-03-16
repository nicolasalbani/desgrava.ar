import type { Page } from "playwright";
import { prismaDirectClient as prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { decrypt } from "@/lib/crypto/encryption";
import { getContext, releaseContext, enqueueJob } from "./browser-pool";
import { loginToArca, navigateToSiradig } from "./arca-navigator";
import {
  navigateToDeductionSection,
  fillDeductionForm,
  submitDeduction,
  findAndEditExisting,
  navigateToCargasFamilia,
  extractCargasFamilia,
  pushCargasFamilia,
} from "./siradig-navigator";
import type { SiradigFamilyDependent } from "./siradig-navigator";
import { navigateToMisComprobantes } from "./mis-comprobantes-navigator";
import { pullDomesticReceipts, pullDomesticWorkersOnly } from "./domestic-navigator";
import { extractReceiptFields } from "@/lib/ocr/receipt-extractor";
import { parseComprobantesCSV, mapComprobantesToInvoices, invoiceDedupeKey } from "./csv-parser";
import { classifyCategory } from "@/lib/ocr/category-classifier";
import { resolveCategory, getCatalogEntry } from "@/lib/catalog/provider-catalog";
import {
  saveScreenshot,
  ensureVideoDir,
  finalizeVideo,
  getJobScreenshots,
  clearJobArtifacts,
} from "./artifact-manager";
import type { ScreenshotMeta } from "./artifact-manager";

export type LogCallback = (jobId: string, message: string) => void;

// In-memory log storage for SSE streaming
const jobLogs = new Map<string, string[]>();
const jobStatuses = new Map<string, string>();
const jobVideoReady = new Map<string, string[]>();

export { getJobScreenshots };
export type { ScreenshotMeta };

export function getJobLogs(jobId: string): string[] {
  return jobLogs.get(jobId) ?? [];
}

export function getJobStatus(jobId: string): string | undefined {
  return jobStatuses.get(jobId);
}

export function getJobVideoFilenames(jobId: string): string[] {
  return jobVideoReady.get(jobId) ?? [];
}

export function clearJobLogs(jobId: string): void {
  jobLogs.delete(jobId);
  jobStatuses.delete(jobId);
  jobVideoReady.delete(jobId);
  clearJobArtifacts(jobId);
}

function setJobStatus(jobId: string, status: string) {
  jobStatuses.set(jobId, status);
}

async function appendLog(jobId: string, message: string, onLog?: LogCallback) {
  const timestamp = new Date().toLocaleTimeString("es-AR");
  const entry = `[${timestamp}] ${message}`;

  const logs = jobLogs.get(jobId) ?? [];
  logs.push(entry);
  jobLogs.set(jobId, logs);

  console.log(`[job:${jobId.slice(0, 8)}] ${message}`);
  onLog?.(jobId, entry);

  // Also persist to DB
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      logs: logs,
    },
  });
}

/**
 * Upsert extracted SiRADIG family dependents into the database.
 * Matches by (userId, fiscalYear, numeroDoc). Returns counts of created/updated.
 */
async function upsertFamilyDependents(
  userId: string,
  fiscalYear: number,
  dependents: SiradigFamilyDependent[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const dep of dependents) {
    // Skip entries with no document number (phantom/empty table rows)
    if (!dep.numeroDoc || !dep.numeroDoc.trim()) {
      continue;
    }

    const existing = await prisma.familyDependent.findFirst({
      where: { userId, fiscalYear, numeroDoc: dep.numeroDoc },
    });

    const data = {
      tipoDoc: dep.tipoDoc,
      numeroDoc: dep.numeroDoc,
      apellido: dep.apellido,
      nombre: dep.nombre,
      fechaNacimiento: dep.fechaNacimiento || null,
      parentesco: dep.parentesco,
      fechaUnion: dep.fechaUnion || null,
      porcentajeDed: dep.porcentajeDed || null,
      cuitOtroDed: dep.cuitOtroDed || null,
      familiaCargo: dep.familiaCargo,
      residente: dep.residente,
      tieneIngresos: dep.tieneIngresos,
      montoIngresos: dep.montoIngresos ? dep.montoIngresos : null,
      mesDesde: dep.mesDesde,
      mesHasta: dep.mesHasta,
      proximosPeriodos: dep.proximosPeriodos,
    };

    if (existing) {
      await prisma.familyDependent.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.familyDependent.create({
        data: { ...data, userId, fiscalYear },
      });
      created++;
    }
  }

  return { created, updated };
}

/**
 * Process a PULL_FAMILY_DEPENDENTS job:
 * navigate to cargas de familia section, extract all rows, upsert into DB.
 */
async function processPullFamilyDependents(
  siradigPage: Page,
  job: { userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  // Navigate to "Carga de Formulario" and expand cargas de familia
  const navResult = await navigateToDeductionSection(
    siradigPage,
    fiscalYear,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!navResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: navResult.error, completedAt: new Date() },
    });
    return;
  }

  // Expand the cargas de familia accordion
  const cfNavResult = await navigateToCargasFamilia(
    siradigPage,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!cfNavResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: cfNavResult.error, completedAt: new Date() },
    });
    return;
  }

  // Extract all family dependents
  const extractResult = await extractCargasFamilia(
    siradigPage,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!extractResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: extractResult.error, completedAt: new Date() },
    });
    return;
  }

  // Upsert into database
  await appendLogFn(jobId, "Sincronizando cargas de familia con la base de datos...", onLog);
  const { created, updated } = await upsertFamilyDependents(
    job.userId,
    fiscalYear,
    extractResult.dependents,
  );

  const summary = `Importacion completada: ${created} creadas, ${updated} actualizadas`;
  await appendLogFn(jobId, summary, onLog);

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData: JSON.parse(
        JSON.stringify({
          created,
          updated,
          total: extractResult.dependents.length,
          dependents: extractResult.dependents,
        }),
      ),
    },
  });
}

/**
 * Process a PUSH_FAMILY_DEPENDENTS job:
 * load local dependents, navigate to cargas de familia section, push each one to SiRADIG.
 */
async function processPushFamilyDependents(
  siradigPage: Page,
  job: { userId: string; fiscalYear?: number | null; familyDependentId?: string | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  // Load the specific dependent to export
  if (!job.familyDependentId) {
    await appendLogFn(jobId, "Falta el ID de la carga de familia", onLog);
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: "Falta el ID de la carga de familia",
        completedAt: new Date(),
      },
    });
    return;
  }

  const dependent = await prisma.familyDependent.findUnique({
    where: { id: job.familyDependentId },
  });

  if (!dependent) {
    await appendLogFn(jobId, "Carga de familia no encontrada", onLog);
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: "Carga de familia no encontrada",
        completedAt: new Date(),
      },
    });
    return;
  }

  const localDependents = [dependent];
  await appendLogFn(
    jobId,
    `Exportando: ${dependent.apellido}, ${dependent.nombre} (${dependent.numeroDoc})`,
    onLog,
  );

  // Navigate to "Carga de Formulario" and expand deductions
  const navResult = await navigateToDeductionSection(
    siradigPage,
    fiscalYear,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!navResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: navResult.error, completedAt: new Date() },
    });
    return;
  }

  // Expand the cargas de familia accordion
  const cfNavResult = await navigateToCargasFamilia(
    siradigPage,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!cfNavResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: cfNavResult.error, completedAt: new Date() },
    });
    return;
  }

  // Convert DB dependents to SiradigFamilyDependent format
  const siradigDependents: SiradigFamilyDependent[] = localDependents.map((dep) => ({
    tipoDoc: dep.tipoDoc,
    numeroDoc: dep.numeroDoc,
    apellido: dep.apellido,
    nombre: dep.nombre,
    fechaNacimiento: dep.fechaNacimiento ?? "",
    parentesco: dep.parentesco,
    fechaUnion: dep.fechaUnion ?? "",
    porcentajeDed: dep.porcentajeDed ?? "",
    cuitOtroDed: dep.cuitOtroDed ?? "",
    familiaCargo: dep.familiaCargo,
    residente: dep.residente,
    tieneIngresos: dep.tieneIngresos,
    montoIngresos: dep.montoIngresos ? dep.montoIngresos.toString() : "",
    mesDesde: dep.mesDesde,
    mesHasta: dep.mesHasta,
    proximosPeriodos: dep.proximosPeriodos,
  }));

  // Push to SiRADIG
  const pushResult = await pushCargasFamilia(
    siradigPage,
    siradigDependents,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  const resultData = JSON.parse(
    JSON.stringify({
      created: pushResult.created,
      updated: pushResult.updated,
      failed: pushResult.failed,
      total: localDependents.length,
    }),
  );

  if (!pushResult.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: pushResult.error,
        completedAt: new Date(),
        resultData,
      },
    });
    return;
  }

  const failedCount = pushResult.failed.length;
  const failedSummary = failedCount > 0 ? `, ${failedCount} con errores` : "";
  const summary = `Exportacion completada: ${pushResult.created} creadas, ${pushResult.updated} actualizadas${failedSummary}`;
  await appendLogFn(jobId, summary, onLog);

  // If some dependents failed but the job itself didn't crash, still mark as COMPLETED
  // but include the failure details in resultData for the UI to show
  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData,
    },
  });
}

/**
 * Process a PULL_DOMESTIC_WORKERS job:
 * navigate to "Personal de Casas Particulares", pull worker info only (no receipts), upsert into DB.
 * Used by "Importar desde ARCA" on the Perfil Impositivo page.
 */
async function processPullDomesticWorkers(
  page: Page,
  job: { userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  await appendLogFn(jobId, "Iniciando importacion de trabajadores domesticos...", onLog);

  const workers = await pullDomesticWorkersOnly(
    page,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  let workersCreated = 0;
  let workersUpdated = 0;

  for (const w of workers) {
    const existing = await prisma.domesticWorker.findFirst({
      where: { userId: job.userId, fiscalYear, cuil: w.cuil },
    });

    if (existing) {
      await prisma.domesticWorker.update({
        where: { id: existing.id },
        data: {
          apellidoNombre: w.apellidoNombre,
          tipoTrabajo: w.tipoTrabajo,
          domicilioLaboral: w.domicilioLaboral,
          horasSemanales: w.horasSemanales,
          condicion: w.condicion,
          obraSocial: w.obraSocial,
          fechaNacimiento: w.fechaNacimiento,
          fechaIngreso: w.fechaIngreso,
          modalidadPago: w.modalidadPago,
          modalidadTrabajo: w.modalidadTrabajo,
          remuneracionPactada: w.remuneracionPactada ? parseFloat(w.remuneracionPactada) : null,
        },
      });
      workersUpdated++;
    } else {
      await prisma.domesticWorker.create({
        data: {
          userId: job.userId,
          fiscalYear,
          cuil: w.cuil,
          apellidoNombre: w.apellidoNombre,
          tipoTrabajo: w.tipoTrabajo,
          domicilioLaboral: w.domicilioLaboral,
          horasSemanales: w.horasSemanales,
          condicion: w.condicion,
          obraSocial: w.obraSocial,
          fechaNacimiento: w.fechaNacimiento,
          fechaIngreso: w.fechaIngreso,
          modalidadPago: w.modalidadPago,
          modalidadTrabajo: w.modalidadTrabajo,
          remuneracionPactada: w.remuneracionPactada ? parseFloat(w.remuneracionPactada) : null,
        },
      });
      workersCreated++;
    }
  }

  await appendLogFn(
    jobId,
    `Trabajadores: ${workersCreated} nuevos, ${workersUpdated} actualizados`,
    onLog,
  );

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData: { workersCreated, workersUpdated },
    },
  });
}

/**
 * Process a PULL_DOMESTIC_RECEIPTS job:
 * Read workers from DB, navigate to "Personal de Casas Particulares",
 * go to "PAGOS Y RECIBOS" for each worker, download receipts for the fiscal year.
 *
 * Workers must be imported first via "Importar desde ARCA" on the Perfil Impositivo page
 * (PULL_DOMESTIC_WORKERS job). This job only pulls receipts for those existing workers.
 */
async function processPullDomesticReceipts(
  page: Page,
  job: { userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  // Read workers from DB — only pull receipts for workers the user has registered
  const dbWorkers = await prisma.domesticWorker.findMany({
    where: { userId: job.userId, fiscalYear },
    select: { id: true, cuil: true, apellidoNombre: true },
  });

  if (dbWorkers.length === 0) {
    await appendLogFn(
      jobId,
      "No hay trabajadores registrados para este año fiscal. Importa trabajadores primero desde Perfil Impositivo.",
      onLog,
    );
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage:
          "No hay trabajadores registrados. Importa trabajadores primero desde Perfil Impositivo.",
        completedAt: new Date(),
      },
    });
    return;
  }

  const workerCuils = dbWorkers.map((w) => w.cuil);
  const cuilToId = new Map(dbWorkers.map((w) => [w.cuil, w.id]));

  await appendLogFn(
    jobId,
    `Importando recibos ${fiscalYear} para ${dbWorkers.length} trabajador(es): ${dbWorkers.map((w) => w.apellidoNombre).join(", ")}`,
    onLog,
  );

  const receiptsData = await pullDomesticReceipts(
    page,
    workerCuils,
    fiscalYear,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  // Upsert receipts
  let receiptsCreated = 0;
  let receiptsUpdated = 0;

  for (const r of receiptsData) {
    const domesticWorkerId = cuilToId.get(r.workerCuil) ?? null;

    // Extract additional fields from PDF if available
    let ocrFields: Record<string, unknown> = {};
    if (r.pdfBuffer) {
      try {
        const { processDocument } = await import("@/lib/ocr/pipeline");
        const ocrResult = await processDocument(r.pdfBuffer, "application/pdf");
        const extracted = extractReceiptFields(ocrResult.text);
        ocrFields = {
          categoriaProfesional: extracted.categoriaProfesional,
          modalidadPrestacion: extracted.modalidadPrestacion,
          horasSemanales: extracted.horasSemanales,
          modalidadLiquidacion: extracted.modalidadLiquidacion,
          totalHorasTrabajadas: extracted.totalHorasTrabajadas,
          basico: extracted.basico,
          antiguedad: extracted.antiguedad,
          viaticos: extracted.viaticos,
          presentismo: extracted.presentismo,
          otros: extracted.otros,
          ocrConfidence: extracted.confidence,
        };

        if (extracted.total && extracted.total > 0) {
          ocrFields.total = extracted.total;
        }
      } catch {
        // OCR is best-effort
      }
    }

    // Calculate contribution amount from payment details
    const contributionAmount = r.paymentDetails
      .filter((d) => d.tipoPago === "APORTES" || d.tipoPago === "CONTRIBUCIONES")
      .reduce((sum, d) => sum + d.importe, 0);

    const contributionDate =
      r.paymentDetails.find((d) => d.tipoPago === "APORTES")?.fechaPago ?? null;

    const totalAmount = (ocrFields.total as number) ?? r.sueldo;
    const contribAmount = contributionAmount || r.pago;

    // Build decimal fields from OCR
    const decimalOcrFields: Record<string, unknown> = {};
    for (const key of ["basico", "antiguedad", "viaticos", "presentismo", "otros"] as const) {
      const val = ocrFields[key] as number | undefined;
      if (val != null) decimalOcrFields[key] = new Prisma.Decimal(val);
    }
    for (const key of [
      "ocrConfidence",
      "categoriaProfesional",
      "modalidadPrestacion",
      "horasSemanales",
      "modalidadLiquidacion",
      "totalHorasTrabajadas",
    ] as const) {
      if (ocrFields[key] != null) decimalOcrFields[key] = ocrFields[key];
    }

    const existing = domesticWorkerId
      ? await prisma.domesticReceipt.findFirst({
          where: {
            userId: job.userId,
            domesticWorkerId,
            fiscalYear: r.fiscalYear,
            fiscalMonth: r.fiscalMonth,
          },
        })
      : null;

     
    const receiptData: any = {
      periodo: r.periodo,
      total: new Prisma.Decimal(totalAmount),
      contributionAmount: new Prisma.Decimal(contribAmount),
      contributionDate,
      paymentDetails: r.paymentDetails.length > 0 ? r.paymentDetails : Prisma.JsonNull,
      source: "ARCA",
      ...decimalOcrFields,
    };

    if (r.pdfBuffer) {
      receiptData.fileData = Buffer.from(r.pdfBuffer);
      receiptData.fileMimeType = "application/pdf";
      receiptData.originalFilename = r.pdfFilename;
    }

    if (existing) {
      await prisma.domesticReceipt.update({
        where: { id: existing.id },
        data: receiptData,
      });
      receiptsUpdated++;
    } else {
      await prisma.domesticReceipt.create({
        data: {
          userId: job.userId,
          domesticWorkerId,
          fiscalYear: r.fiscalYear,
          fiscalMonth: r.fiscalMonth,
          ...receiptData,
        },
      });
      receiptsCreated++;
    }
  }

  await appendLogFn(
    jobId,
    `Recibos: ${receiptsCreated} nuevos, ${receiptsUpdated} actualizados`,
    onLog,
  );

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData: { receiptsCreated, receiptsUpdated },
    },
  });
}

/**
 * Process a PULL_COMPROBANTES job:
 * navigate to Mis Comprobantes, export CSV, parse, deduplicate, classify, and bulk import.
 * This flow does NOT go through SiRADIG — it stays on the ARCA portal.
 */
async function processPullComprobantes(
  page: Page,
  job: { userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  // Navigate to Mis Comprobantes and export CSV
  const result = await navigateToMisComprobantes(
    page,
    fiscalYear,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!result.success) {
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: result.error, completedAt: new Date() },
    });
    return;
  }

  if (!result.csvContent || result.csvContent.trim() === "") {
    await appendLogFn(jobId, "No se encontraron comprobantes para importar", onLog);
    setJobStatus(jobId, "COMPLETED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultData: JSON.parse(JSON.stringify({ total: 0, imported: 0, skipped: 0, errors: 0 })),
      },
    });
    return;
  }

  // Parse CSV
  await appendLogFn(jobId, "Procesando CSV...", onLog);
  let comprobantes;
  try {
    const parsed = parseComprobantesCSV(result.csvContent);
    comprobantes = mapComprobantesToInvoices(parsed, fiscalYear);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error procesando CSV";
    await appendLogFn(jobId, `Error al parsear CSV: ${msg}`, onLog);
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: msg, completedAt: new Date() },
    });
    return;
  }

  await appendLogFn(jobId, `${comprobantes.length} comprobantes encontrados en el CSV`, onLog);

  // Build deduplication set from existing invoices
  const existingInvoices = await prisma.invoice.findMany({
    where: { userId: job.userId, fiscalYear },
    select: { providerCuit: true, invoiceNumber: true, fiscalYear: true },
  });

  const existingKeys = new Set(
    existingInvoices.map((inv) =>
      invoiceDedupeKey(inv.providerCuit, inv.invoiceNumber, inv.fiscalYear),
    ),
  );

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Batch cache: resolve each CUIT once via catalog, reuse for all invoices from same provider
  const categoryCache = new Map<string, string>();

  for (let i = 0; i < comprobantes.length; i++) {
    const comp = comprobantes[i];
    const key = invoiceDedupeKey(comp.providerCuit, comp.invoiceNumber, comp.fiscalYear);

    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    try {
      // Resolve category via catalog (cached per CUIT within this batch)
      let category = categoryCache.get(comp.providerCuit);
      if (!category) {
        category = await resolveCategory({
          cuit: comp.providerCuit,
          providerName: comp.providerName,
          invoiceType: comp.invoiceType,
          amount: comp.amount,
        });
        categoryCache.set(comp.providerCuit, category);
      }

      await prisma.invoice.create({
        data: {
          userId: job.userId,
          providerCuit: comp.providerCuit,
          providerName: comp.providerName,
          invoiceType: comp.invoiceType as import("@/generated/prisma/client").InvoiceType,
          invoiceNumber: comp.invoiceNumber,
          invoiceDate: comp.invoiceDate,
          amount: comp.amount,
          fiscalYear: comp.fiscalYear,
          fiscalMonth: comp.fiscalMonth,
          deductionCategory: category as import("@/generated/prisma/client").DeductionCategory,
          source: "ARCA",
        },
      });

      // Add to dedup set so subsequent duplicates in the same CSV are caught
      existingKeys.add(key);
      imported++;

      // Log progress every 10 invoices
      if ((imported + skipped) % 10 === 0 || i === comprobantes.length - 1) {
        await appendLogFn(
          jobId,
          `Progreso: ${imported} importadas, ${skipped} duplicadas, ${errors} errores (${i + 1}/${comprobantes.length})`,
          onLog,
        );
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : "Error desconocido";
      await appendLogFn(jobId, `Error importando comprobante ${comp.invoiceNumber}: ${msg}`, onLog);
    }
  }

  const summary = `Importacion completada: ${imported} importadas, ${skipped} duplicadas, ${errors} errores de ${comprobantes.length} total`;
  await appendLogFn(jobId, summary, onLog);

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData: JSON.parse(
        JSON.stringify({
          total: comprobantes.length,
          imported,
          skipped,
          errors,
        }),
      ),
    },
  });
}

export async function processJob(jobId: string, onLog?: LogCallback): Promise<void> {
  return enqueueJob(async () => {
    const job = await prisma.automationJob.findUnique({
      where: { id: jobId },
      include: {
        user: { include: { arcaCredential: true, yearPreferences: true } },
        invoice: { include: { familyDependent: true } },
      },
    });

    if (!job) throw new Error("Job no encontrado");
    if (!job.user.arcaCredential) {
      setJobStatus(jobId, "FAILED");
      await prisma.automationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: "No hay credenciales ARCA configuradas" },
      });
      return;
    }

    const credential = job.user.arcaCredential;
    const userId = job.userId;

    // Update status
    setJobStatus(jobId, "RUNNING");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Screenshot step counter
    let stepCounter = 0;

    const onScreenshot = async (buffer: Buffer, slug: string, label: string) => {
      stepCounter++;
      await saveScreenshot(jobId, stepCounter, slug, label, buffer);
      await appendLog(jobId, `Screenshot: ${label}`, onLog);
    };

    try {
      // Decrypt credentials
      await appendLog(jobId, "Desencriptando credenciales...", onLog);
      const clave = decrypt(credential.encryptedClave, credential.iv, credential.authTag);

      // Get browser context with video recording
      await appendLog(jobId, "Iniciando navegador...", onLog);
      const videoDir = await ensureVideoDir(jobId);
      const context = await getContext(userId, { recordVideoDir: videoDir });
      const page = await context.newPage();

      try {
        // Login to ARCA
        const loginResult = await loginToArca(
          page,
          credential.cuit,
          clave,
          (msg) => appendLog(jobId, msg, onLog),
          onScreenshot,
        );

        if (!loginResult.success) {
          setJobStatus(jobId, "FAILED");
          await prisma.automationJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              errorMessage: loginResult.error,
              completedAt: new Date(),
            },
          });

          if (loginResult.hasCaptcha) {
            await appendLog(jobId, "Job pausado por CAPTCHA. Reintenta mas tarde.", onLog);
          }
          return;
        }

        // ── PULL_COMPROBANTES flow (stays on ARCA portal, no SiRADIG) ──
        if (job.jobType === "PULL_COMPROBANTES") {
          await processPullComprobantes(page, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // ── PULL_DOMESTIC_WORKERS flow (workers only, no receipts) ──
        if (job.jobType === "PULL_DOMESTIC_WORKERS") {
          await processPullDomesticWorkers(page, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // ── PULL_DOMESTIC_RECEIPTS flow (workers + receipts) ──
        if (job.jobType === "PULL_DOMESTIC_RECEIPTS") {
          await processPullDomesticReceipts(page, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // Navigate to SiRADIG (opens in a new tab)
        const siradigPage = await navigateToSiradig(
          page,
          (msg) => appendLog(jobId, msg, onLog),
          onScreenshot,
        );

        if (!siradigPage) {
          setJobStatus(jobId, "FAILED");
          await prisma.automationJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              errorMessage: "No se pudo acceder a SiRADIG",
              completedAt: new Date(),
            },
          });
          return;
        }

        // ── PULL_FAMILY_DEPENDENTS flow ──
        if (job.jobType === "PULL_FAMILY_DEPENDENTS") {
          await processPullFamilyDependents(
            siradigPage,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
          );
          return;
        }

        // ── PUSH_FAMILY_DEPENDENTS flow ──
        if (job.jobType === "PUSH_FAMILY_DEPENDENTS") {
          await processPushFamilyDependents(
            siradigPage,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
          );
          return;
        }

        // Navigate through SiRADIG to the deductions section
        // (person selection → period → draft → form → deductions accordion)
        if (job.invoice) {
          const navResult = await navigateToDeductionSection(
            siradigPage,
            job.invoice.fiscalYear,
            (msg) => appendLog(jobId, msg, onLog),
            onScreenshot,
          );

          if (!navResult.success) {
            setJobStatus(jobId, "FAILED");
            await prisma.automationJob.update({
              where: { id: jobId },
              data: {
                status: "FAILED",
                errorMessage: navResult.error,
                completedAt: new Date(),
              },
            });
            return;
          }

          // Fill the deduction form (category selection + comprobante dialog)
          const fillResult = await fillDeductionForm(
            siradigPage,
            {
              deductionCategory: job.invoice.deductionCategory,
              providerCuit: job.invoice.providerCuit,
              invoiceType: job.invoice.invoiceType,
              invoiceNumber: job.invoice.invoiceNumber ?? undefined,
              invoiceDate: job.invoice.invoiceDate?.toISOString() ?? undefined,
              amount: job.invoice.amount.toString(),
              fiscalMonth: job.invoice.fiscalMonth,
              contractStartDate: job.invoice.contractStartDate?.toISOString() ?? undefined,
              contractEndDate: job.invoice.contractEndDate?.toISOString() ?? undefined,
              ownsProperty:
                job.user.yearPreferences.find((p) => p.fiscalYear === job.invoice!.fiscalYear)
                  ?.ownsProperty ?? false,
              familyDependent: job.invoice.familyDependent
                ? {
                    numeroDoc: job.invoice.familyDependent.numeroDoc,
                    apellido: job.invoice.familyDependent.apellido,
                    nombre: job.invoice.familyDependent.nombre,
                  }
                : undefined,
            },
            (msg) => appendLog(jobId, msg, onLog),
            onScreenshot,
          );

          if (!fillResult.success) {
            setJobStatus(jobId, "FAILED");
            await prisma.automationJob.update({
              where: { id: jobId },
              data: {
                status: "FAILED",
                errorMessage: fillResult.error,
                completedAt: new Date(),
              },
            });
            return;
          }

          // Submit the deduction
          let submitResult = await submitDeduction(
            siradigPage,
            (msg) => appendLog(jobId, msg, onLog),
            onScreenshot,
          );

          // If duplicate detected, try to find and edit the existing entry
          if (!submitResult.success && submitResult.isDuplicate && job.invoice) {
            await appendLog(
              jobId,
              "Comprobante ya existe en SiRADIG — intentando actualizar...",
              onLog,
            );
            const editResult = await findAndEditExisting(
              siradigPage,
              {
                deductionCategory: job.invoice.deductionCategory,
                providerCuit: job.invoice.providerCuit,
                invoiceType: job.invoice.invoiceType,
                invoiceNumber: job.invoice.invoiceNumber ?? undefined,
                invoiceDate: job.invoice.invoiceDate?.toISOString() ?? undefined,
                amount: job.invoice.amount.toString(),
                fiscalMonth: job.invoice.fiscalMonth,
                contractStartDate: job.invoice.contractStartDate?.toISOString() ?? undefined,
                contractEndDate: job.invoice.contractEndDate?.toISOString() ?? undefined,
                ownsProperty:
                  job.user.yearPreferences.find((p) => p.fiscalYear === job.invoice!.fiscalYear)
                    ?.ownsProperty ?? false,
                familyDependent: job.invoice.familyDependent
                  ? {
                      numeroDoc: job.invoice.familyDependent.numeroDoc,
                      apellido: job.invoice.familyDependent.apellido,
                      nombre: job.invoice.familyDependent.nombre,
                    }
                  : undefined,
              },
              (msg) => appendLog(jobId, msg, onLog),
              onScreenshot,
            );

            if (editResult.success) {
              // Re-submit the edited form
              submitResult = await submitDeduction(
                siradigPage,
                (msg) => appendLog(jobId, msg, onLog),
                onScreenshot,
              );
            } else {
              submitResult = editResult;
            }
          }

          setJobStatus(jobId, submitResult.success ? "COMPLETED" : "FAILED");
          await prisma.automationJob.update({
            where: { id: jobId },
            data: {
              status: submitResult.success ? "COMPLETED" : "FAILED",
              errorMessage: submitResult.error,
              completedAt: new Date(),
            },
          });

          if (submitResult.success && job.invoiceId) {
            await prisma.invoice.update({
              where: { id: job.invoiceId },
              data: { siradiqStatus: "SUBMITTED" },
            });
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      await appendLog(jobId, `Error: ${msg}`, onLog);
      setJobStatus(jobId, "FAILED");
      await prisma.automationJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: msg,
          completedAt: new Date(),
        },
      });
    } finally {
      await releaseContext(userId);

      // Finalize video after context is released (recording is done)
      try {
        const videoFilenames = await finalizeVideo(jobId);
        if (videoFilenames.length > 0) {
          jobVideoReady.set(jobId, videoFilenames);
          await appendLog(jobId, "Grabacion de video disponible.", onLog);
        }
      } catch {
        // Video finalization is best-effort
      }
    }
  });
}
