import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobLogs } from "@/lib/automation/job-processor";

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
  let lastIndex = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendLogs = () => {
        const logs = getJobLogs(jobId);
        while (lastIndex < logs.length) {
          const data = JSON.stringify({ log: logs[lastIndex] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          lastIndex++;
        }
      };

      // Poll for new logs
      const interval = setInterval(async () => {
        sendLogs();

        // Check if job is done
        const currentJob = await prisma.automationJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });

        if (
          currentJob &&
          ["COMPLETED", "FAILED", "CANCELLED", "WAITING_CONFIRMATION"].includes(
            currentJob.status
          )
        ) {
          sendLogs(); // Final flush
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, status: currentJob.status })}\n\n`
            )
          );
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Initial send
      sendLogs();
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
