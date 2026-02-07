import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmJob } from "@/lib/automation/job-processor";

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

  return NextResponse.json({ job });
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
