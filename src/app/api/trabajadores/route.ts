import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDomesticWorkerSchema } from "@/lib/validators/domestic";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const fiscalYear = searchParams.get("fiscalYear");

  const where: Prisma.DomesticWorkerWhereInput = {
    userId: session.user.id,
  };

  if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);

  const workers = await prisma.domesticWorker.findMany({
    where,
    include: {
      _count: { select: { receipts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createDomesticWorkerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Check for duplicate worker (same CUIL + fiscal year)
    const existing = await prisma.domesticWorker.findFirst({
      where: {
        userId: session.user.id,
        cuil: parsed.data.cuil,
        fiscalYear: parsed.data.fiscalYear,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un trabajador con ese CUIL para este año fiscal" },
        { status: 409 },
      );
    }

    const worker = await prisma.domesticWorker.create({
      data: {
        userId: session.user.id,
        ...parsed.data,
        remuneracionPactada: parsed.data.remuneracionPactada
          ? new Prisma.Decimal(parsed.data.remuneracionPactada)
          : null,
      },
    });

    return NextResponse.json({ worker }, { status: 201 });
  } catch (error) {
    console.error("Error creating worker:", error);
    return NextResponse.json({ error: "Error al crear trabajador" }, { status: 500 });
  }
}
