import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobScreenshots, getJobVideoFilenames } from "@/lib/automation/job-processor";
import { listScreenshotsFromDisk, listVideosFromDisk } from "@/lib/automation/artifact-manager";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
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
  const videoUrls = videoFiles.map((f) => `/api/automatizacion/${jobId}/artifacts/${f}`);

  return NextResponse.json({ job, screenshots, videoUrls });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
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

  if (action === "cancel") {
    if (job.status !== "PENDING" && job.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Solo se pueden cancelar jobs pendientes o en ejecución" },
        { status: 409 },
      );
    }

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

    // Reset receipt statuses for SUBMIT_DOMESTIC_DEDUCTION jobs
    if (job.jobType === "SUBMIT_DOMESTIC_DEDUCTION") {
      const jobWithReceipts = await prisma.automationJob.findUnique({
        where: { id: jobId },
        select: { domesticReceipts: { select: { id: true } } },
      });
      if (jobWithReceipts?.domesticReceipts.length) {
        await prisma.domesticReceipt.updateMany({
          where: { id: { in: jobWithReceipts.domesticReceipts.map((r) => r.id) } },
          data: { siradiqStatus: "PENDING" },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Job cancelado" });
  }

  return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
}
