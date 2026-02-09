import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getJobLogs,
  getJobStatus,
  getJobScreenshots,
  getJobVideoFilename,
} from "@/lib/automation/job-processor";

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED", "WAITING_CONFIRMATION"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return new Response("Job no encontrado", { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastLogIndex = 0;
  let lastScreenshotIndex = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdates = () => {
        // Send new logs
        const logs = getJobLogs(jobId);
        while (lastLogIndex < logs.length) {
          const data = JSON.stringify({ log: logs[lastLogIndex] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          lastLogIndex++;
        }

        // Send new screenshot metadata
        const screenshots = getJobScreenshots(jobId);
        while (lastScreenshotIndex < screenshots.length) {
          const meta = screenshots[lastScreenshotIndex];
          const data = JSON.stringify({
            screenshot: {
              step: meta.step,
              name: meta.name,
              label: meta.label,
              timestamp: meta.timestamp,
              url: `/api/automatizacion/${jobId}/artifacts/${meta.name}`,
            },
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          lastScreenshotIndex++;
        }
      };

      // Poll for new logs and screenshots
      const interval = setInterval(() => {
        sendUpdates();

        const status = getJobStatus(jobId);
        if (status && TERMINAL_STATUSES.includes(status)) {
          sendUpdates(); // Final flush

          const videoFilename = getJobVideoFilename(jobId);
          const terminalData: Record<string, unknown> = {
            done: true,
            status,
          };
          if (videoFilename) {
            terminalData.videoUrl = `/api/automatizacion/${jobId}/artifacts/video`;
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(terminalData)}\n\n`)
          );
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Initial send
      sendUpdates();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
