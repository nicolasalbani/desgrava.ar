import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDomesticReceiptSchema } from "@/lib/validators/domestic";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const fiscalYear = searchParams.get("fiscalYear");
  const status = searchParams.get("status");
  const workerId = searchParams.get("workerId");

  const where: Prisma.DomesticReceiptWhereInput = {
    userId: session.user.id,
  };

  if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
  if (status) where.siradiqStatus = status as Prisma.EnumSiradiqStatusFilter["equals"];
  if (workerId) where.domesticWorkerId = workerId;

  const receipts = await prisma.domesticReceipt.findMany({
    where,
    select: {
      id: true,
      domesticWorkerId: true,
      fiscalYear: true,
      fiscalMonth: true,
      periodo: true,
      categoriaProfesional: true,
      total: true,
      contributionAmount: true,
      source: true,
      siradiqStatus: true,
      originalFilename: true,
      fileMimeType: true,
      createdAt: true,
      domesticWorker: {
        select: { id: true, apellidoNombre: true, cuil: true },
      },
      automationJobs: {
        where: { jobType: "SUBMIT_DOMESTIC_DEDUCTION" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, errorMessage: true },
      },
    },
    orderBy: [{ fiscalYear: "desc" }, { fiscalMonth: "desc" }],
  });

  const result = receipts.map((r) => {
    const { automationJobs, ...rest } = r;
    return {
      ...rest,
      hasFile: !!r.fileMimeType,
      latestJob: automationJobs[0] ?? null,
    };
  });

  return NextResponse.json({ receipts: result });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileBase64, fileMimeType, originalFilename, ...receiptBody } = body;
    const parsed = createDomesticReceiptSchema.safeParse(receiptBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify worker belongs to user if provided
    if (parsed.data.domesticWorkerId) {
      const worker = await prisma.domesticWorker.findFirst({
        where: { id: parsed.data.domesticWorkerId, userId: session.user.id },
      });
      if (!worker) {
        return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
      }
    }

    const receipt = await prisma.domesticReceipt.create({
      data: {
        userId: session.user.id,
        domesticWorkerId: parsed.data.domesticWorkerId || null,
        fiscalYear: parsed.data.fiscalYear,
        fiscalMonth: parsed.data.fiscalMonth,
        periodo: parsed.data.periodo,
        categoriaProfesional: parsed.data.categoriaProfesional,
        modalidadPrestacion: parsed.data.modalidadPrestacion,
        horasSemanales: parsed.data.horasSemanales,
        modalidadLiquidacion: parsed.data.modalidadLiquidacion,
        totalHorasTrabajadas: parsed.data.totalHorasTrabajadas,
        basico: parsed.data.basico ? new Prisma.Decimal(parsed.data.basico) : null,
        antiguedad: parsed.data.antiguedad ? new Prisma.Decimal(parsed.data.antiguedad) : null,
        viaticos: parsed.data.viaticos ? new Prisma.Decimal(parsed.data.viaticos) : null,
        presentismo: parsed.data.presentismo ? new Prisma.Decimal(parsed.data.presentismo) : null,
        otros: parsed.data.otros ? new Prisma.Decimal(parsed.data.otros) : null,
        total: new Prisma.Decimal(parsed.data.total),
        paymentDetails: parsed.data.paymentDetails ?? undefined,
        contributionAmount: parsed.data.contributionAmount
          ? new Prisma.Decimal(parsed.data.contributionAmount)
          : null,
        contributionDate: parsed.data.contributionDate,
        source: fileBase64 ? "PDF" : "MANUAL",
        ...(fileBase64
          ? {
              fileData: Buffer.from(fileBase64, "base64"),
              fileMimeType: fileMimeType || "application/octet-stream",
              originalFilename: originalFilename || null,
            }
          : {}),
      },
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error("Error creating receipt:", error);
    return NextResponse.json({ error: "Error al crear recibo" }, { status: 500 });
  }
}
