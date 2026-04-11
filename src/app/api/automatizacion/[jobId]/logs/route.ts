import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobLogs, getJobStatus, getJobStep } from "@/lib/automation/job-processor";

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
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

  // If the job is already terminal (e.g. after server restart), respond immediately
  if (TERMINAL_STATUSES.includes(job.status)) {
    const terminalData = JSON.stringify({ done: true, status: job.status });
    return new Response(`data: ${terminalData}\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();
  let lastLogIndex = 0;
  let lastSentStatus = "";
  let lastSentStep = "";
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const sendUpdates = () => {
        if (closed) return;

        // Send new logs
        const logs = getJobLogs(jobId);
        while (lastLogIndex < logs.length) {
          enqueue(JSON.stringify({ log: logs[lastLogIndex] }));
          lastLogIndex++;
        }

        // Send step changes
        const currentStep = getJobStep(jobId);
        if (currentStep && currentStep !== lastSentStep) {
          lastSentStep = currentStep;
          enqueue(JSON.stringify({ step: currentStep }));
        }

        // Send status changes
        const currentStatus = getJobStatus(jobId);
        if (currentStatus && currentStatus !== lastSentStatus) {
          lastSentStatus = currentStatus;
          enqueue(JSON.stringify({ status: currentStatus }));
        }
      };

      // Abort when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        closeStream();
      });

      // Poll for new logs and status
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        sendUpdates();

        let status = getJobStatus(jobId);

        // Fallback to DB when in-memory state is lost (e.g. after server restart)
        if (!status) {
          try {
            const dbJob = await prisma.automationJob.findUnique({
              where: { id: jobId },
              select: { status: true, currentStep: true },
            });
            if (dbJob) {
              status = dbJob.status;
              if (dbJob.currentStep && dbJob.currentStep !== lastSentStep) {
                lastSentStep = dbJob.currentStep;
                enqueue(JSON.stringify({ step: dbJob.currentStep }));
              }
            }
          } catch {
            // DB query failed, will retry next interval
          }
        }

        if (status && TERMINAL_STATUSES.includes(status)) {
          sendUpdates(); // Final flush

          enqueue(JSON.stringify({ done: true, status }));
          clearInterval(interval);
          closeStream();
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
