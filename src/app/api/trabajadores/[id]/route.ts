import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDomesticWorkerSchema } from "@/lib/validators/domestic";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const worker = await prisma.domesticWorker.findFirst({
    where: { id, userId: session.user.id },
    include: { receipts: { orderBy: { fiscalMonth: "desc" } } },
  });

  if (!worker) {
    return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ worker });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.domesticWorker.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateDomesticWorkerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.remuneracionPactada !== undefined) {
      updateData.remuneracionPactada = parsed.data.remuneracionPactada
        ? new Prisma.Decimal(parsed.data.remuneracionPactada)
        : null;
    }

    const worker = await prisma.domesticWorker.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ worker });
  } catch (error) {
    console.error("Error updating worker:", error);
    return NextResponse.json({ error: "Error al actualizar trabajador" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.domesticWorker.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { receipts: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  }

  await prisma.domesticWorker.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
