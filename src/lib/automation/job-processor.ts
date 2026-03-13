import type { Page } from "playwright";
import { prismaDirectClient as prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/encryption";
import { getContext, releaseContext, enqueueJob } from "./browser-pool";
import { loginToArca, navigateToSiradig } from "./arca-navigator";
import {
  navigateToDeductionSection,
  fillDeductionForm,
  submitDeduction,
  navigateToCargasFamilia,
  extractCargasFamilia,
} from "./siradig-navigator";
import type { SiradigFamilyDependent } from "./siradig-navigator";
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

export async function processJob(jobId: string, onLog?: LogCallback): Promise<void> {
  return enqueueJob(async () => {
    const job = await prisma.automationJob.findUnique({
      where: { id: jobId },
      include: {
        user: { include: { arcaCredential: true, yearPreferences: true } },
        invoice: true,
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
          const submitResult = await submitDeduction(
            siradigPage,
            (msg) => appendLog(jobId, msg, onLog),
            onScreenshot,
          );

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
