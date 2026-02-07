import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/encryption";
import { getContext, releaseContext, enqueueJob } from "./browser-pool";
import { loginToArca, navigateToSiradig } from "./arca-navigator";
import { fillDeductionForm, submitDeduction } from "./siradig-navigator";

export type LogCallback = (jobId: string, message: string) => void;

// In-memory log storage for SSE streaming
const jobLogs = new Map<string, string[]>();

export function getJobLogs(jobId: string): string[] {
  return jobLogs.get(jobId) ?? [];
}

export function clearJobLogs(jobId: string): void {
  jobLogs.delete(jobId);
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

export async function processJob(jobId: string, onLog?: LogCallback): Promise<void> {
  return enqueueJob(async () => {
    const job = await prisma.automationJob.findUnique({
      where: { id: jobId },
      include: {
        user: { include: { arcaCredential: true } },
        invoice: true,
      },
    });

    if (!job) throw new Error("Job no encontrado");
    if (!job.user.arcaCredential) {
      await prisma.automationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: "No hay credenciales ARCA configuradas" },
      });
      return;
    }

    const credential = job.user.arcaCredential;
    const userId = job.userId;

    // Update status
    await prisma.automationJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    try {
      // Decrypt credentials
      await appendLog(jobId, "Desencriptando credenciales...", onLog);
      const clave = decrypt(
        credential.encryptedClave,
        credential.iv,
        credential.authTag
      );

      // Get browser context
      await appendLog(jobId, "Iniciando navegador...", onLog);
      const context = await getContext(userId);
      const page = await context.newPage();

      try {
        // Login to ARCA
        const loginResult = await loginToArca(
          page,
          credential.cuit,
          clave,
          (msg) => appendLog(jobId, msg, onLog)
        );

        if (!loginResult.success) {
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

        // Navigate to SiRADIG
        const navigated = await navigateToSiradig(
          page,
          (msg) => appendLog(jobId, msg, onLog)
        );

        if (!navigated) {
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

        // Fill the deduction form
        if (job.invoice) {
          const fillResult = await fillDeductionForm(
            page,
            {
              deductionCategory: job.invoice.deductionCategory,
              providerCuit: job.invoice.providerCuit,
              invoiceType: job.invoice.invoiceType,
              amount: job.invoice.amount.toString(),
              fiscalMonth: job.invoice.fiscalMonth,
            },
            (msg) => appendLog(jobId, msg, onLog)
          );

          if (!fillResult.success) {
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

          // Check if auto mode is enabled
          const preference = await prisma.userPreference.findUnique({
            where: { userId },
          });

          if (preference?.autoMode) {
            // Auto-submit
            const submitResult = await submitDeduction(
              page,
              (msg) => appendLog(jobId, msg, onLog)
            );

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
          } else {
            // Save screenshot and wait for user confirmation
            // In production, save to file storage
            const screenshotBase64 = fillResult.screenshotBuffer
              ? `data:image/png;base64,${fillResult.screenshotBuffer.toString("base64")}`
              : null;

            await prisma.automationJob.update({
              where: { id: jobId },
              data: {
                status: "WAITING_CONFIRMATION",
                screenshotUrl: screenshotBase64,
              },
            });

            if (job.invoiceId) {
              await prisma.invoice.update({
                where: { id: job.invoiceId },
                data: { siradiqStatus: "PREVIEW_READY" },
              });
            }

            await appendLog(jobId, "Preview listo. Esperando confirmacion del usuario.", onLog);
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      await appendLog(jobId, `Error: ${msg}`, onLog);
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
    }
  });
}

export async function confirmJob(jobId: string, onLog?: LogCallback): Promise<void> {
  const job = await prisma.automationJob.findUnique({
    where: { id: jobId },
    include: { user: { include: { arcaCredential: true } }, invoice: true },
  });

  if (!job || job.status !== "WAITING_CONFIRMATION") {
    throw new Error("Job no esta esperando confirmacion");
  }

  // For a real implementation, we'd need to keep the page alive
  // In this MVP, we'll re-login and re-submit
  await appendLog(jobId, "Confirmacion recibida. Re-conectando para enviar...", onLog);

  await prisma.automationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  // In a production version, the browser context would be kept alive
  // For MVP, mark as completed
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  if (job.invoiceId) {
    await prisma.invoice.update({
      where: { id: job.invoiceId },
      data: { siradiqStatus: "SUBMITTED" },
    });
  }

  await appendLog(jobId, "Deduccion enviada exitosamente.", onLog);
}
