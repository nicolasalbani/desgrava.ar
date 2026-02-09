import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readScreenshotFile, readVideoFile } from "@/lib/automation/artifact-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { jobId, filename } = await params;

  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return new Response("No encontrado", { status: 404 });
  }

  // Video file
  if (filename === "video" || filename === "recording.webm") {
    const buffer = await readVideoFile(jobId);
    if (!buffer) {
      return new Response("Video no disponible", { status: 404 });
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "video/webm",
        "Content-Disposition": `inline; filename="job-${jobId}-recording.webm"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // Screenshot file
  const buffer = await readScreenshotFile(jobId, filename);
  if (!buffer) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
