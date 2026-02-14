import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmJob, getJobScreenshots, getJobVideoFilenames } from "@/lib/automation/job-processor";
import { listScreenshotsFromDisk, listVideosFromDisk } from "@/lib/automation/artifact-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
    include: {
      invoice: {
        select: {
          deductionCategory: true,
          providerCuit: true,
          amount: true,
          invoiceType: true,
          fiscalMonth: true,
          fiscalYear: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }

  // Return screenshots: prefer in-memory, fall back to disk
  let screenshotsMeta = getJobScreenshots(jobId);
  if (screenshotsMeta.length === 0) {
    screenshotsMeta = await listScreenshotsFromDisk(jobId);
  }
  const screenshots = screenshotsMeta.map((s) => ({
    step: s.step,
    name: s.name,
    label: s.label,
    timestamp: s.timestamp,
    url: `/api/automatizacion/${jobId}/artifacts/${s.name}`,
  }));

  // Return video URLs if available
  let videoFiles = getJobVideoFilenames(jobId);
  if (videoFiles.length === 0) {
    videoFiles = await listVideosFromDisk(jobId);
  }
  const videoUrls = videoFiles.map(
    (f) => `/api/automatizacion/${jobId}/artifacts/${f}`
  );

  return NextResponse.json({ job, screenshots, videoUrls });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "confirm") {
    try {
      await confirmJob(jobId);
      return NextResponse.json({ success: true, message: "Job confirmado" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (action === "cancel") {
    await prisma.automationJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    if (job.invoiceId) {
      await prisma.invoice.update({
        where: { id: job.invoiceId },
        data: { siradiqStatus: "PENDING" },
      });
    }

    return NextResponse.json({ success: true, message: "Job cancelado" });
  }

  return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
}

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }

  if (!TERMINAL_STATUSES.includes(job.status)) {
    return NextResponse.json(
      { error: "Solo se pueden eliminar jobs finalizados. Cancela el job primero." },
      { status: 409 }
    );
  }

  await prisma.automationJob.delete({ where: { id: jobId } });

  // Reset invoice status if no other jobs remain for it
  if (job.invoiceId) {
    const remaining = await prisma.automationJob.count({
      where: { invoiceId: job.invoiceId },
    });
    if (remaining === 0) {
      await prisma.invoice.update({
        where: { id: job.invoiceId },
        data: { siradiqStatus: "PENDING" },
      });
    }
  }

  return NextResponse.json({ success: true });
}
