import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDomesticReceiptSchema } from "@/lib/validators/domestic";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const receipt = await prisma.domesticReceipt.findFirst({
    where: { id, userId: session.user.id },
    include: {
      domesticWorker: { select: { id: true, apellidoNombre: true, cuil: true } },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ receipt });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.domesticReceipt.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateDomesticReceiptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    const decimalFields = [
      "total",
      "basico",
      "antiguedad",
      "viaticos",
      "presentismo",
      "otros",
      "contributionAmount",
    ] as const;

    for (const field of decimalFields) {
      if (parsed.data[field] !== undefined) {
        updateData[field] = parsed.data[field] ? new Prisma.Decimal(parsed.data[field]) : null;
      }
    }

    const receipt = await prisma.domesticReceipt.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("Error updating receipt:", error);
    return NextResponse.json({ error: "Error al actualizar recibo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.domesticReceipt.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      automationJobs: { select: { id: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }

  const linkedJobIds = existing.automationJobs.map((j) => j.id);

  await prisma.domesticReceipt.delete({ where: { id } });

  // Clean up orphaned jobs (jobs that no longer have any linked receipts or invoices)
  if (linkedJobIds.length > 0) {
    const orphanedJobs = await prisma.automationJob.findMany({
      where: {
        id: { in: linkedJobIds },
        invoiceId: null,
        domesticReceipts: { none: {} },
      },
      select: { id: true },
    });
    if (orphanedJobs.length > 0) {
      await prisma.automationJob.deleteMany({
        where: { id: { in: orphanedJobs.map((j) => j.id) } },
      });
    }
  }

  return NextResponse.json({ success: true });
}
