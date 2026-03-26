import type { Page } from "playwright";
import { prismaDirectClient as prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { decrypt } from "@/lib/crypto/encryption";
import { getContext, releaseContext, enqueueJob } from "./browser-pool";
import { loginToArca, navigateToSiradig } from "./arca-navigator";
import {
  navigateToDeductionSection,
  navigateToSiradigMainMenu,
  fillDeductionForm,
  fillDomesticDeductionForm,
  submitDeduction,
  findAndEditExisting,
  navigateToCargasFamilia,
  extractCargasFamilia,
  pushCargasFamilia,
  extractSiradigDeductions,
  isAlquilerExtraction,
  isDomesticoExtraction,
  isStandardExtraction,
  parseSiradigAmount,
} from "./siradig-navigator";
import type {
  SiradigFamilyDependent,
  DomesticWorkerDeduction,
  ExtractedEntry,
  ExtractedDeduction,
  ExtractedAlquilerDeduction,
  ExtractedDomesticoDeduction,
} from "./siradig-navigator";
import { navigateToMisComprobantes } from "./mis-comprobantes-navigator";
import { pullDomesticReceipts, pullDomesticWorkersOnly } from "./domestic-navigator";
import {
  pullPresentaciones,
  submitPresentacion,
  extractMontoTotalFromText,
} from "./presentacion-navigator";
import { extractReceiptFields } from "@/lib/ocr/receipt-extractor";
import { parseComprobantesCSV, mapComprobantesToInvoices, invoiceDedupeKey } from "./csv-parser";
import { resolveCategory } from "@/lib/catalog/provider-catalog";
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
const jobSteps = new Map<string, string>();
const jobVideoReady = new Map<string, string[]>();

export { getJobScreenshots };
export type { ScreenshotMeta };

export function getJobLogs(jobId: string): string[] {
  return jobLogs.get(jobId) ?? [];
}

export function getJobStatus(jobId: string): string | undefined {
  return jobStatuses.get(jobId);
}

export function getJobStep(jobId: string): string | undefined {
  return jobSteps.get(jobId);
}

export function getJobVideoFilenames(jobId: string): string[] {
  return jobVideoReady.get(jobId) ?? [];
}

export function clearJobLogs(jobId: string): void {
  jobLogs.delete(jobId);
  jobStatuses.delete(jobId);
  jobSteps.delete(jobId);
  jobVideoReady.delete(jobId);
  clearJobArtifacts(jobId);
}

function setJobStatus(jobId: string, status: string) {
  jobStatuses.set(jobId, status);
  if (status === "COMPLETED") {
    jobSteps.set(jobId, "done");
  }
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

async function appendStep(jobId: string, stepKey: string, _onLog?: LogCallback) {
  jobSteps.set(jobId, stepKey);
  // Persist to DB
  await prisma.automationJob.update({
    where: { id: jobId },
    data: { currentStep: stepKey },
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

  await appendStep(jobId, "save", onLog);
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
  await appendStep(jobId, "save", onLog);
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
  appendStepFn: typeof appendStep,
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

  // Filter out duplicates first
  const newComprobantes = comprobantes.filter((comp) => {
    const key = invoiceDedupeKey(comp.providerCuit, comp.invoiceNumber, comp.fiscalYear);
    if (existingKeys.has(key)) {
      skipped++;
      return false;
    }
    // Add to dedup set so subsequent duplicates in the same CSV are caught
    existingKeys.add(key);
    return true;
  });

  await appendLogFn(
    jobId,
    `${skipped} duplicadas, ${newComprobantes.length} nuevas para importar`,
    onLog,
  );

  // ── Phase 1: Parallel category resolution ─────────────────
  await appendStepFn(jobId, "classify", onLog);
  const categoryCache = new Map<string, string>();

  // Collect unique CUITs that need resolution, with representative invoice data
  const uniqueCuits = new Map<
    string,
    { providerName: string; invoiceType: string; amount: number }
  >();
  for (const comp of newComprobantes) {
    if (!uniqueCuits.has(comp.providerCuit)) {
      uniqueCuits.set(comp.providerCuit, {
        providerName: comp.providerName,
        invoiceType: comp.invoiceType,
        amount: comp.amount,
      });
    }
  }

  const cuitsToResolve = Array.from(uniqueCuits.entries());
  const CATEGORY_CONCURRENCY = 8;
  let resolvedCount = 0;

  for (let i = 0; i < cuitsToResolve.length; i += CATEGORY_CONCURRENCY) {
    const chunk = cuitsToResolve.slice(i, i + CATEGORY_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async ([cuit, data]) => {
        const category = await resolveCategory({
          cuit,
          providerName: data.providerName,
          invoiceType: data.invoiceType,
          amount: data.amount,
        });
        return { cuit, category };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        categoryCache.set(result.value.cuit, result.value.category);
      }
      // Failed resolutions will be handled during insert phase
    }

    resolvedCount += chunk.length;
    await appendLogFn(
      jobId,
      `Clasificando proveedores: ${resolvedCount}/${cuitsToResolve.length}`,
      onLog,
    );
  }

  // ── Phase 2: Batch database inserts ───────────────────────
  await appendStepFn(jobId, "save", onLog);
  const INSERT_BATCH_SIZE = 50;
  const invoicesToInsert: Prisma.InvoiceCreateManyInput[] = [];

  for (const comp of newComprobantes) {
    const category = categoryCache.get(comp.providerCuit);
    if (!category) {
      // Category resolution failed for this CUIT — try individual fallback
      try {
        const fallback = await resolveCategory({
          cuit: comp.providerCuit,
          providerName: comp.providerName,
          invoiceType: comp.invoiceType,
          amount: comp.amount,
        });
        categoryCache.set(comp.providerCuit, fallback);
        invoicesToInsert.push({
          userId: job.userId,
          providerCuit: comp.providerCuit,
          providerName: comp.providerName,
          invoiceType: comp.invoiceType as import("@/generated/prisma/client").InvoiceType,
          invoiceNumber: comp.invoiceNumber,
          invoiceDate: comp.invoiceDate,
          amount: comp.amount,
          fiscalYear: comp.fiscalYear,
          fiscalMonth: comp.fiscalMonth,
          deductionCategory: fallback as import("@/generated/prisma/client").DeductionCategory,
          source: "ARCA",
        });
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : "Error desconocido";
        await appendLogFn(
          jobId,
          `Error clasificando comprobante ${comp.invoiceNumber}: ${msg}`,
          onLog,
        );
      }
      continue;
    }

    invoicesToInsert.push({
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
    });
  }

  for (let i = 0; i < invoicesToInsert.length; i += INSERT_BATCH_SIZE) {
    const batch = invoicesToInsert.slice(i, i + INSERT_BATCH_SIZE);
    try {
      const result = await prisma.invoice.createMany({ data: batch });
      imported += result.count;
    } catch (err) {
      // If batch fails, fall back to individual inserts to isolate errors
      for (const inv of batch) {
        try {
          await prisma.invoice.create({ data: inv });
          imported++;
        } catch (innerErr) {
          errors++;
          const msg = innerErr instanceof Error ? innerErr.message : "Error desconocido";
          await appendLogFn(
            jobId,
            `Error importando comprobante ${inv.invoiceNumber}: ${msg}`,
            onLog,
          );
        }
      }
    }
    await appendLogFn(
      jobId,
      `Importadas: ${imported}/${invoicesToInsert.length} (${errors} errores)`,
      onLog,
    );
  }

  // Count deducible vs non-deducible among successfully prepared invoices
  const deducible = invoicesToInsert.filter(
    (inv) => inv.deductionCategory !== "NO_DEDUCIBLE",
  ).length;
  const nonDeducible = invoicesToInsert.filter(
    (inv) => inv.deductionCategory === "NO_DEDUCIBLE",
  ).length;

  const summary = `Importacion completada: ${imported} importadas (${deducible} deducibles, ${nonDeducible} no deducibles), ${skipped} duplicadas, ${errors} errores de ${comprobantes.length} total`;
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
          deducible,
          nonDeducible,
        }),
      ),
    },
  });
}

// ─── SiRADIG Deduction Extraction Phase ──────────────────────────────────

/**
 * Non-fatal phase that opens SiRADIG after ARCA import and extracts
 * existing deductions, upserting them into desgrava.ar.
 *
 * @param mode "invoices" extracts standard + alquiler + education categories as Invoice records.
 *             "domestic" extracts SERVICIO_DOMESTICO as DomesticReceipt records.
 */
async function runSiradigExtractionPhase(
  arcaPage: Page,
  job: { userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
  appendStepFn: typeof appendStep,
  mode: "invoices" | "domestic",
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  await appendStepFn(jobId, "siradig", onLog);
  await appendLogFn(jobId, "Abriendo SiRADIG para leer deducciones existentes...", onLog);

  const siradigPage = await navigateToSiradig(
    arcaPage,
    (msg) => appendLogFn(jobId, msg, onLog),
    onScreenshot,
  );

  if (!siradigPage) {
    const error = "No se pudo abrir SiRADIG";
    await appendLogFn(jobId, error, onLog);
    setJobStatus(jobId, "FAILED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: error, completedAt: new Date() },
    });
    throw new Error(error);
  }

  try {
    // Navigate to deductions section
    const navResult = await navigateToDeductionSection(
      siradigPage,
      fiscalYear,
      (msg) => appendLogFn(jobId, msg, onLog),
      onScreenshot,
    );

    if (!navResult.success) {
      const error = `No se pudo navegar a deducciones en SiRADIG: ${navResult.error}`;
      await appendLogFn(jobId, error, onLog);
      setJobStatus(jobId, "FAILED");
      await prisma.automationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: error, completedAt: new Date() },
      });
      throw new Error(error);
    }

    await appendStepFn(jobId, "siradig_extract", onLog);

    // Determine which categories to extract based on mode
    const categories =
      mode === "invoices"
        ? new Set([
            "GASTOS_MEDICOS",
            "PRIMAS_SEGURO_MUERTE",
            "GASTOS_INDUMENTARIA_TRABAJO",
            "ALQUILER_VIVIENDA",
            "GASTOS_EDUCATIVOS",
            "CUOTAS_MEDICO_ASISTENCIALES",
          ])
        : new Set(["SERVICIO_DOMESTICO"]);

    const entries = await extractSiradigDeductions(
      siradigPage,
      categories,
      (msg) => appendLogFn(jobId, msg, onLog),
      onScreenshot,
    );

    if (entries.length === 0) {
      await appendLogFn(jobId, "No se encontraron deducciones en SiRADIG", onLog);
      return;
    }

    // Upsert extracted entries into the database
    const counts = await upsertExtractedDeductions(entries, job.userId, fiscalYear, (msg) =>
      appendLogFn(jobId, msg, onLog),
    );

    await appendLogFn(
      jobId,
      `SiRADIG: ${counts.created} nuevas, ${counts.updated} actualizadas de ${entries.length} entradas`,
      onLog,
    );

    // Update job resultData with extraction counts
    const currentJob = await prisma.automationJob.findUnique({
      where: { id: jobId },
      select: { resultData: true },
    });
    const currentData =
      currentJob?.resultData && typeof currentJob.resultData === "object"
        ? (currentJob.resultData as Record<string, unknown>)
        : {};

    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        resultData: JSON.parse(
          JSON.stringify({
            ...currentData,
            siradigExtracted: entries.length,
            siradigCreated: counts.created,
            siradigUpdated: counts.updated,
          }),
        ),
      },
    });
  } finally {
    // Close the SiRADIG tab
    await siradigPage.close().catch(() => {});
  }
}

/**
 * Upsert extracted SiRADIG deductions into the database.
 * Returns counts of created and updated records.
 */
async function upsertExtractedDeductions(
  entries: ExtractedEntry[],
  userId: string,
  fiscalYear: number,
  log: (msg: string) => void,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    try {
      if (isAlquilerExtraction(entry)) {
        const result = await upsertAlquilerDeduction(entry, userId, fiscalYear);
        created += result.created;
        updated += result.updated;
      } else if (isDomesticoExtraction(entry)) {
        const result = await upsertDomesticoDeduction(entry, userId, fiscalYear);
        created += result.created;
        updated += result.updated;
      } else if (isStandardExtraction(entry)) {
        const result = await upsertStandardDeduction(entry, userId, fiscalYear);
        created += result.created;
        updated += result.updated;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      log(`Error upserting ${entry.category}: ${msg}`);
    }
  }

  return { created, updated };
}

/**
 * Ensure an invoice has a COMPLETED SUBMIT_INVOICE job so the UI shows "Completado".
 * If one already exists, skip. Otherwise create a synthetic one.
 */
async function ensureCompletedJob(invoiceId: string, userId: string): Promise<void> {
  const existing = await prisma.automationJob.findFirst({
    where: { invoiceId, jobType: "SUBMIT_INVOICE", status: "COMPLETED" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.automationJob.create({
    data: {
      userId,
      invoiceId,
      jobType: "SUBMIT_INVOICE",
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      logs: JSON.parse(JSON.stringify(["Importado desde SiRADIG"])),
    },
  });
}

/**
 * Ensure a domestic receipt has a COMPLETED SUBMIT_DOMESTIC_DEDUCTION job.
 */
async function ensureCompletedDomesticJob(receiptIds: string[], userId: string): Promise<void> {
  if (receiptIds.length === 0) return;

  // Check if there's already a completed job linked to any of these receipts
  const existing = await prisma.automationJob.findFirst({
    where: {
      userId,
      jobType: "SUBMIT_DOMESTIC_DEDUCTION",
      status: "COMPLETED",
      domesticReceipts: { some: { id: { in: receiptIds } } },
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.automationJob.create({
    data: {
      userId,
      jobType: "SUBMIT_DOMESTIC_DEDUCTION",
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      logs: JSON.parse(JSON.stringify(["Importado desde SiRADIG"])),
      domesticReceipts: { connect: receiptIds.map((id) => ({ id })) },
    },
  });
}

/**
 * Upsert a standard deduction entry. Each comprobante becomes an Invoice record.
 */
async function upsertStandardDeduction(
  entry: ExtractedDeduction,
  userId: string,
  fiscalYear: number,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const cuit = entry.providerCuit.replace(/[-\s]/g, "");

  // If there are comprobantes, create one invoice per comprobante
  if (entry.comprobantes.length > 0) {
    for (const comp of entry.comprobantes) {
      // Determine fiscal month from the comprobante date or the entry period
      let fiscalMonth = entry.periodoDesde;
      if (comp.fechaEmision) {
        // Try to parse DD/MM/YYYY
        const parts = comp.fechaEmision.split("/");
        if (parts.length === 3) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) fiscalMonth = monthNum;
        }
      }

      const invoiceNumber =
        comp.puntoVenta && comp.numero
          ? `${comp.puntoVenta.padStart(5, "0")}-${comp.numero.padStart(8, "0")}`
          : undefined;

      // Parse invoice date from DD/MM/YYYY to ISO
      let invoiceDate: Date | undefined;
      if (comp.fechaEmision) {
        const parts = comp.fechaEmision.split("/");
        if (parts.length === 3) {
          invoiceDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
        }
      }

      const amount = parseFloat(comp.montoFacturado) || 0;

      // Match by invoice number first (most specific), fall back to CUIT+month+category
      const existing = invoiceNumber
        ? await prisma.invoice.findFirst({
            where: { userId, providerCuit: cuit, invoiceNumber, fiscalYear },
          })
        : await prisma.invoice.findFirst({
            where: {
              userId,
              providerCuit: cuit,
              fiscalYear,
              fiscalMonth,
              deductionCategory:
                entry.category as import("@/generated/prisma/client").DeductionCategory,
            },
          });

      // For GASTOS_EDUCATIVOS, try to link family dependent
      let familyDependentId: string | null = null;
      if (entry.category === "GASTOS_EDUCATIVOS" && entry.familiarName) {
        familyDependentId = await linkEducationFamilyDependent(entry, userId, fiscalYear);
      }

      let invoiceId: string;
      if (existing) {
        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            amount: new Prisma.Decimal(amount),
            invoiceNumber,
            invoiceDate,
            invoiceType: (comp.tipoEnum ??
              existing.invoiceType) as import("@/generated/prisma/client").InvoiceType,
            providerName: entry.providerName || existing.providerName,
            familyDependentId: familyDependentId ?? existing.familyDependentId,
            siradiqStatus: "SUBMITTED",
            source: "ARCA",
          },
        });
        invoiceId = existing.id;
        updated++;
      } else {
        const inv = await prisma.invoice.create({
          data: {
            userId,
            providerCuit: cuit,
            providerName: entry.providerName,
            invoiceType: (comp.tipoEnum ??
              "FACTURA_B") as import("@/generated/prisma/client").InvoiceType,
            invoiceNumber,
            invoiceDate,
            amount: new Prisma.Decimal(amount),
            fiscalYear,
            fiscalMonth,
            deductionCategory:
              entry.category as import("@/generated/prisma/client").DeductionCategory,
            familyDependentId,
            siradiqStatus: "SUBMITTED",
            source: "ARCA",
          },
        });
        invoiceId = inv.id;
        created++;
      }
      await ensureCompletedJob(invoiceId, userId);
    }
  } else {
    // No comprobantes — create a single invoice from the entry's total
    const amount = parseFloat(parseSiradigAmount(entry.montoTotal)) || 0;

    const existing = await prisma.invoice.findFirst({
      where: {
        userId,
        providerCuit: cuit,
        fiscalYear,
        fiscalMonth: entry.periodoDesde,
        deductionCategory: entry.category as import("@/generated/prisma/client").DeductionCategory,
      },
    });

    let invoiceId: string;
    if (existing) {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          amount: new Prisma.Decimal(amount),
          providerName: entry.providerName || existing.providerName,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      invoiceId = existing.id;
      updated++;
    } else {
      const inv = await prisma.invoice.create({
        data: {
          userId,
          providerCuit: cuit,
          providerName: entry.providerName,
          invoiceType: "FACTURA_B",
          amount: new Prisma.Decimal(amount),
          fiscalYear,
          fiscalMonth: entry.periodoDesde,
          deductionCategory:
            entry.category as import("@/generated/prisma/client").DeductionCategory,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      invoiceId = inv.id;
      created++;
    }
    await ensureCompletedJob(invoiceId, userId);
  }

  return { created, updated };
}

/**
 * Upsert GASTOS_EDUCATIVOS with family dependent linking.
 * Falls through to upsertStandardDeduction but also tries to match familiarName
 * to an existing FamilyDependent.
 */
async function linkEducationFamilyDependent(
  entry: ExtractedDeduction,
  userId: string,
  fiscalYear: number,
): Promise<string | null> {
  if (!entry.familiarName) return null;

  // Try to find a matching family dependent by name
  const dependents = await prisma.familyDependent.findMany({
    where: { userId, fiscalYear },
    select: { id: true, nombre: true, apellido: true },
  });

  // Normalize: strip commas, extra spaces, and lowercase for comparison.
  // SiRADIG uses "APELLIDO, NOMBRE" while DB stores "APELLIDO" + "NOMBRE" separately.
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[,.\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const familiarNorm = normalize(entry.familiarName);
  const match = dependents.find((d) => {
    const fullName = normalize(`${d.apellido} ${d.nombre}`);
    return familiarNorm.includes(fullName) || fullName.includes(familiarNorm);
  });

  return match?.id ?? null;
}

/**
 * Upsert an ALQUILER_VIVIENDA deduction. Each month becomes a separate Invoice.
 */
async function upsertAlquilerDeduction(
  entry: ExtractedAlquilerDeduction,
  userId: string,
  fiscalYear: number,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const cuit = entry.providerCuit.replace(/[-\s]/g, "");

  // Parse contract dates from DD/MM/YYYY to ISO
  const parseDate = (ddmmyyyy: string | undefined): Date | undefined => {
    if (!ddmmyyyy) return undefined;
    const parts = ddmmyyyy.split("/");
    if (parts.length !== 3) return undefined;
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
  };

  const contractStart = parseDate(entry.contractStartDate);
  const contractEnd = parseDate(entry.contractEndDate);

  // Build a lookup of comprobantes by month (from their fechaEmision DD/MM/YYYY)
  const compsByMonth = new Map<number, (typeof entry.comprobantes)[number][]>();
  for (const comp of entry.comprobantes) {
    if (comp.fechaEmision) {
      const parts = comp.fechaEmision.split("/");
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        if (monthNum >= 1 && monthNum <= 12) {
          const arr = compsByMonth.get(monthNum) ?? [];
          arr.push(comp);
          compsByMonth.set(monthNum, arr);
        }
      }
    }
  }

  for (const m of entry.months) {
    const amount = parseFloat(m.amount) || 0;
    const monthComps = compsByMonth.get(m.month) ?? [];
    const comp = monthComps[0]; // Use first comprobante for this month

    // Build invoice number and date from comprobante if available
    const invoiceNumber =
      comp?.puntoVenta && comp?.numero
        ? `${comp.puntoVenta.padStart(5, "0")}-${comp.numero.padStart(8, "0")}`
        : undefined;

    let invoiceDate: Date | undefined;
    if (comp?.fechaEmision) {
      const parts = comp.fechaEmision.split("/");
      if (parts.length === 3) {
        invoiceDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
      }
    }

    const invoiceType = (comp?.tipoEnum ??
      "FACTURA_B") as import("@/generated/prisma/client").InvoiceType;

    // Match by invoice number first (most specific), fall back to CUIT+month+category
    const existing = invoiceNumber
      ? await prisma.invoice.findFirst({
          where: { userId, providerCuit: cuit, invoiceNumber, fiscalYear },
        })
      : await prisma.invoice.findFirst({
          where: {
            userId,
            providerCuit: cuit,
            fiscalYear,
            fiscalMonth: m.month,
            deductionCategory: "ALQUILER_VIVIENDA",
          },
        });

    let invoiceId: string;
    if (existing) {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          amount: new Prisma.Decimal(amount),
          invoiceNumber: invoiceNumber ?? existing.invoiceNumber,
          invoiceDate: invoiceDate ?? existing.invoiceDate,
          invoiceType: invoiceType ?? existing.invoiceType,
          providerName: entry.providerName || existing.providerName,
          contractStartDate: contractStart ?? existing.contractStartDate,
          contractEndDate: contractEnd ?? existing.contractEndDate,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      invoiceId = existing.id;
      updated++;
    } else {
      const inv = await prisma.invoice.create({
        data: {
          userId,
          providerCuit: cuit,
          providerName: entry.providerName,
          invoiceType,
          invoiceNumber,
          invoiceDate,
          amount: new Prisma.Decimal(amount),
          fiscalYear,
          fiscalMonth: m.month,
          deductionCategory: "ALQUILER_VIVIENDA",
          contractStartDate: contractStart,
          contractEndDate: contractEnd,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      invoiceId = inv.id;
      created++;
    }
    await ensureCompletedJob(invoiceId, userId);
  }

  return { created, updated };
}

/**
 * Upsert SERVICIO_DOMESTICO deductions as DomesticReceipt records.
 */
async function upsertDomesticoDeduction(
  entry: ExtractedDomesticoDeduction,
  userId: string,
  fiscalYear: number,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const receiptIds: string[] = [];

  // Find the matching DomesticWorker by CUIL
  const worker = await prisma.domesticWorker.findFirst({
    where: { userId, fiscalYear, cuil: entry.workerCuil },
    select: { id: true },
  });

  if (!worker) {
    // Worker not in DB — can't create receipts without a worker reference
    return { created: 0, updated: 0 };
  }

  for (const detail of entry.monthlyDetails) {
    const contribAmount = parseFloat(detail.contributionAmount) || 0;
    const salaryAmount = parseFloat(detail.salaryAmount) || 0;

    // Build month name for periodo field
    const monthNames = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const periodo = `${monthNames[detail.month]} ${fiscalYear}`;

    const existing = await prisma.domesticReceipt.findFirst({
      where: {
        userId,
        domesticWorkerId: worker.id,
        fiscalYear,
        fiscalMonth: detail.month,
      },
    });

    let receiptId: string;
    if (existing) {
      await prisma.domesticReceipt.update({
        where: { id: existing.id },
        data: {
          total: new Prisma.Decimal(salaryAmount || existing.total.toNumber()),
          contributionAmount: new Prisma.Decimal(contribAmount),
          contributionDate: detail.contributionDate || existing.contributionDate,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      receiptId = existing.id;
      updated++;
    } else {
      const receipt = await prisma.domesticReceipt.create({
        data: {
          userId,
          domesticWorkerId: worker.id,
          fiscalYear,
          fiscalMonth: detail.month,
          periodo,
          total: new Prisma.Decimal(salaryAmount || 0),
          contributionAmount: new Prisma.Decimal(contribAmount),
          contributionDate: detail.contributionDate || null,
          siradiqStatus: "SUBMITTED",
          source: "ARCA",
        },
      });
      receiptId = receipt.id;
      created++;
    }
    receiptIds.push(receiptId);
  }

  // Create a single COMPLETED job linking all receipts for this worker
  await ensureCompletedDomesticJob(receiptIds, userId);

  return { created, updated };
}

/**
 * Submit domestic worker deductions to SiRADIG.
 *
 * For each worker with receipts in the target fiscal year:
 * 1. Opens "Deducción del personal doméstico" form
 * 2. Fills CUIL + name
 * 3. Adds monthly payment details (contribution + salary)
 * 4. Clicks Guardar
 *
 * The `page` should already be on SiRADIG (post-login, post-person-selection).
 */
async function processSubmitDomesticDeduction(
  siradigPage: Page,
  job: { userId: string; fiscalYear?: number | null; resultData?: Prisma.JsonValue },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
): Promise<void> {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  // Extract optional receipt IDs filter from job metadata
  const receiptIds: string[] | null =
    job.resultData &&
    typeof job.resultData === "object" &&
    !Array.isArray(job.resultData) &&
    "receiptIds" in job.resultData &&
    Array.isArray((job.resultData as Record<string, unknown>).receiptIds)
      ? ((job.resultData as Record<string, unknown>).receiptIds as string[])
      : null;

  // Navigate to deductions section (person → period → draft → form → accordion)
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

  // Fetch workers + their receipts for this fiscal year.
  // If receiptIds were provided, only include those specific receipts.
  const receiptFilter: Prisma.DomesticReceiptWhereInput = {
    fiscalYear,
    siradiqStatus: { in: ["PENDING", "FAILED"] },
    ...(receiptIds ? { id: { in: receiptIds } } : {}),
  };

  const workers = await prisma.domesticWorker.findMany({
    where: { userId: job.userId, fiscalYear },
    include: {
      receipts: {
        where: receiptFilter,
        orderBy: { fiscalMonth: "asc" },
      },
    },
  });

  const workersWithReceipts = workers.filter((w) => w.receipts.length > 0);

  if (workersWithReceipts.length === 0) {
    await appendLogFn(jobId, "No hay recibos pendientes para enviar a SiRADIG", onLog);
    setJobStatus(jobId, "COMPLETED");
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  await appendLogFn(
    jobId,
    `${workersWithReceipts.length} trabajador(es) con ${workersWithReceipts.reduce((s, w) => s + w.receipts.length, 0)} recibos pendientes`,
    onLog,
  );

  let totalSubmitted = 0;
  let totalFailed = 0;

  for (const worker of workersWithReceipts) {
    await appendLogFn(
      jobId,
      `--- Procesando ${worker.apellidoNombre} (CUIL ${worker.cuil}) ---`,
      onLog,
    );

    // Build month data from receipts
    const months: DomesticWorkerDeduction["months"] = worker.receipts.map((r) => ({
      fiscalMonth: r.fiscalMonth,
      contributionAmount: r.contributionAmount?.toString() ?? "0",
      contributionDate: r.contributionDate ?? "",
      salaryAmount: r.total.toString(),
      salaryDate: r.contributionDate ?? "", // use same date as contribution
    }));

    const deduction: DomesticWorkerDeduction = {
      cuil: worker.cuil,
      apellidoNombre: worker.apellidoNombre,
      months,
    };

    // Fill the form
    const fillResult = await fillDomesticDeductionForm(
      siradigPage,
      deduction,
      (msg) => appendLogFn(jobId, msg, onLog),
      onScreenshot,
    );

    if (!fillResult.success) {
      await appendLogFn(
        jobId,
        `Error al completar formulario para ${worker.apellidoNombre}: ${fillResult.error}`,
        onLog,
      );
      // Mark these receipts as failed
      await prisma.domesticReceipt.updateMany({
        where: { id: { in: worker.receipts.map((r) => r.id) } },
        data: { siradiqStatus: "FAILED" },
      });
      totalFailed += worker.receipts.length;
      continue;
    }

    // Click Guardar
    const saveResult = await submitDeduction(
      siradigPage,
      (msg) => appendLogFn(jobId, msg, onLog),
      onScreenshot,
    );

    if (saveResult.success) {
      await appendLogFn(
        jobId,
        `Deduccion domestica guardada para ${worker.apellidoNombre} (${worker.receipts.length} meses)`,
        onLog,
      );
      // Mark receipts as submitted
      await prisma.domesticReceipt.updateMany({
        where: { id: { in: worker.receipts.map((r) => r.id) } },
        data: { siradiqStatus: "SUBMITTED" },
      });
      totalSubmitted += worker.receipts.length;
    } else {
      await appendLogFn(
        jobId,
        `Error al guardar deduccion para ${worker.apellidoNombre}: ${saveResult.error}`,
        onLog,
      );
      await prisma.domesticReceipt.updateMany({
        where: { id: { in: worker.receipts.map((r) => r.id) } },
        data: { siradiqStatus: "FAILED" },
      });
      totalFailed += worker.receipts.length;
    }

    // If there are more workers, navigate back to deductions section
    if (workersWithReceipts.indexOf(worker) < workersWithReceipts.length - 1) {
      await appendLogFn(jobId, "Volviendo a la seccion de deducciones...", onLog);
      // After Guardar, SiRADIG returns to the form list. We need to re-expand
      // the deductions accordion and continue.
      try {
        const deductionsSection = siradigPage.getByText("Deducciones y desgravaciones").first();
        await deductionsSection.waitFor({ timeout: 10_000 });
        await deductionsSection.click();
        await siradigPage.waitForLoadState("networkidle");
        await siradigPage.waitForTimeout(1_000);
      } catch {
        await appendLogFn(jobId, "No se pudo volver a la seccion de deducciones", onLog);
      }
    }
  }

  await appendLogFn(
    jobId,
    `Resultado: ${totalSubmitted} recibos enviados, ${totalFailed} fallidos`,
    onLog,
  );

  const finalStatus = totalFailed > 0 && totalSubmitted === 0 ? "FAILED" : "COMPLETED";
  setJobStatus(jobId, finalStatus);
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      resultData: JSON.stringify({ totalSubmitted, totalFailed }),
    },
  });
}

// ── PULL_PRESENTACIONES flow ──
async function processPullPresentaciones(
  siradigPage: Page,
  job: { id: string; userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
) {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  await appendLogFn(jobId, `Importando presentaciones para ${fiscalYear}...`, onLog);

  const result = await pullPresentaciones(
    siradigPage,
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

  // Upsert presentaciones into DB
  let created = 0;
  let updated = 0;

  for (const p of result.presentaciones) {
    const fechaEnvio = parseDateDDMMYYYY(p.fechaEnvio);
    const fechaLectura = p.fechaLectura ? parseDateDDMMYYYY(p.fechaLectura) : null;

    const existing = await prisma.presentacion.findUnique({
      where: {
        userId_fiscalYear_numero: {
          userId: job.userId,
          fiscalYear,
          numero: p.numero,
        },
      },
    });

    const pdfData = p.pdfBuffer ? new Uint8Array(p.pdfBuffer) : null;

    // Extract monto total from PDF if available
    let montoTotal: string | null = null;
    if (p.pdfBuffer) {
      try {
        montoTotal = await extractMontoFromPdfBuffer(p.pdfBuffer);
        if (montoTotal) {
          await appendLogFn(jobId, `Monto total presentacion ${p.numero}: $${montoTotal}`, onLog);
        }
      } catch {
        // best-effort
      }
    }

    if (existing) {
      await prisma.presentacion.update({
        where: { id: existing.id },
        data: {
          descripcion: p.descripcion,
          fechaEnvio: fechaEnvio ?? new Date(),
          fechaLectura: fechaLectura,
          source: "ARCA_IMPORT",
          siradiqStatus: "SUBMITTED",
          ...(montoTotal ? { montoTotal: new Prisma.Decimal(montoTotal) } : {}),
          ...(pdfData
            ? {
                fileData: pdfData,
                fileMimeType: "application/pdf",
                originalFilename: `presentacion-${fiscalYear}-${p.numero}.pdf`,
              }
            : {}),
        },
      });
      updated++;
    } else {
      await prisma.presentacion.create({
        data: {
          userId: job.userId,
          fiscalYear,
          numero: p.numero,
          descripcion: p.descripcion,
          fechaEnvio: fechaEnvio ?? new Date(),
          fechaLectura: fechaLectura,
          source: "ARCA_IMPORT",
          siradiqStatus: "SUBMITTED",
          ...(montoTotal ? { montoTotal: new Prisma.Decimal(montoTotal) } : {}),
          ...(pdfData
            ? {
                fileData: pdfData,
                fileMimeType: "application/pdf",
                originalFilename: `presentacion-${fiscalYear}-${p.numero}.pdf`,
              }
            : {}),
        },
      });
      created++;
    }
  }

  await appendLogFn(
    jobId,
    `Importacion completada: ${created} nuevas, ${updated} actualizadas`,
    onLog,
  );

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultData: JSON.stringify({ created, updated, total: result.presentaciones.length }),
    },
  });
}

// ── SUBMIT_PRESENTACION flow ──
async function processSubmitPresentacion(
  siradigPage: Page,
  job: { id: string; userId: string; fiscalYear?: number | null },
  jobId: string,
  onLog: LogCallback | undefined,
  onScreenshot: (buffer: Buffer, slug: string, label: string) => Promise<void>,
  appendLogFn: typeof appendLog,
) {
  const fiscalYear = job.fiscalYear ?? new Date().getFullYear();

  await appendLogFn(jobId, `Enviando presentacion para ${fiscalYear}...`, onLog);

  const result = await submitPresentacion(
    siradigPage,
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

  // Create the presentacion record
  const numero = result.numero ?? (await getNextPresentacionNumero(job.userId, fiscalYear));
  const descripcion =
    result.descripcion ?? (numero === 1 ? "Original" : `Rectificativa ${numero - 1}`);
  const submitPdfData = result.pdfBuffer ? new Uint8Array(result.pdfBuffer) : null;

  const presentacion = await prisma.presentacion.create({
    data: {
      userId: job.userId,
      fiscalYear,
      numero,
      descripcion,
      fechaEnvio: new Date(),
      source: "AUTOMATION",
      siradiqStatus: "SUBMITTED",
      ...(submitPdfData
        ? {
            fileData: submitPdfData,
            fileMimeType: "application/pdf",
            originalFilename: `presentacion-${fiscalYear}-${numero}.pdf`,
          }
        : {}),
    },
  });

  // Link the automation job to the presentacion
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      presentacionId: presentacion.id,
    },
  });

  // Try to extract monto total from PDF
  if (result.pdfBuffer) {
    try {
      const monto = await extractMontoFromPdfBuffer(result.pdfBuffer);
      if (monto) {
        await prisma.presentacion.update({
          where: { id: presentacion.id },
          data: { montoTotal: new Prisma.Decimal(monto) },
        });
        await appendLogFn(jobId, `Monto total extraido del PDF: $${monto}`, onLog);
      }
    } catch {
      // PDF parsing is best-effort
    }
  }

  await appendLogFn(jobId, `Presentacion ${numero} (${descripcion}) enviada exitosamente`, onLog);

  setJobStatus(jobId, "COMPLETED");
  await prisma.automationJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

async function getNextPresentacionNumero(userId: string, fiscalYear: number): Promise<number> {
  const latest = await prisma.presentacion.findFirst({
    where: { userId, fiscalYear },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (latest?.numero ?? 0) + 1;
}

async function extractMontoFromPdfBuffer(pdfBuffer: Buffer): Promise<string | null> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;

  let pdfText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const pdfPage = await doc.getPage(i);
    const content = await pdfPage.getTextContent();

    pdfText += (content.items as any[])
      .filter((item) => "str" in item)
      .map((item) => item.str)
      .join(" ");
  }

  return extractMontoTotalFromText(pdfText);
}

function parseDateDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
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
      await appendStep(jobId, "login", onLog);
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

        // ── PULL_COMPROBANTES flow (SiRADIG extraction first, then ARCA import) ──
        if (job.jobType === "PULL_COMPROBANTES") {
          // Phase 1: Extract already-deducted entries from SiRADIG (fails job on error)
          await runSiradigExtractionPhase(
            page,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
            appendStep,
            "invoices",
          );

          // Phase 2: Import from Mis Comprobantes CSV
          await appendStep(jobId, "download", onLog);
          await processPullComprobantes(
            page,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
            appendStep,
          );
          return;
        }

        // ── PULL_DOMESTIC_WORKERS flow (workers only, no receipts) ──
        if (job.jobType === "PULL_DOMESTIC_WORKERS") {
          await appendStep(jobId, "download", onLog);
          await processPullDomesticWorkers(page, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // ── PULL_DOMESTIC_RECEIPTS flow (SiRADIG extraction first, then ARCA import) ──
        if (job.jobType === "PULL_DOMESTIC_RECEIPTS") {
          // Phase 1: Extract already-deducted domestic entries from SiRADIG (fails job on error)
          await runSiradigExtractionPhase(
            page,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
            appendStep,
            "domestic",
          );

          // Phase 2: Import receipts from ARCA
          await appendStep(jobId, "download", onLog);
          await processPullDomesticReceipts(page, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // Navigate to SiRADIG (opens in a new tab)
        await appendStep(jobId, "siradig", onLog);
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
          await appendStep(jobId, "extract", onLog);
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
          await appendStep(jobId, "upload", onLog);
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

        // ── SUBMIT_DOMESTIC_DEDUCTION flow ──
        if (job.jobType === "SUBMIT_DOMESTIC_DEDUCTION") {
          await appendStep(jobId, "fill", onLog);
          await processSubmitDomesticDeduction(
            siradigPage,
            job,
            jobId,
            onLog,
            onScreenshot,
            appendLog,
          );
          return;
        }

        // ── PULL_PRESENTACIONES flow ──
        if (job.jobType === "PULL_PRESENTACIONES") {
          // Only navigate to the main menu (person + period), NOT into Carga de Formulario
          const navResult = await navigateToSiradigMainMenu(
            siradigPage,
            job.fiscalYear ?? new Date().getFullYear(),
            (msg) => appendLog(jobId, msg, onLog),
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
          await appendStep(jobId, "download", onLog);
          await processPullPresentaciones(siradigPage, job, jobId, onLog, onScreenshot, appendLog);
          return;
        }

        // ── SUBMIT_PRESENTACION flow ──
        if (job.jobType === "SUBMIT_PRESENTACION") {
          // Only navigate to the main menu (person + period), NOT into Carga de Formulario
          const navResult = await navigateToSiradigMainMenu(
            siradigPage,
            job.fiscalYear ?? new Date().getFullYear(),
            (msg) => appendLog(jobId, msg, onLog),
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
          await appendStep(jobId, "submit", onLog);
          await processSubmitPresentacion(siradigPage, job, jobId, onLog, onScreenshot, appendLog);
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
          await appendStep(jobId, "fill", onLog);
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
