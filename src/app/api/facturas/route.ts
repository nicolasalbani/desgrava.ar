import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validators/invoice";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const fiscalYear = searchParams.get("fiscalYear");
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const where: Prisma.InvoiceWhereInput = {
    userId: session.user.id,
  };

  if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
  if (status) where.siradiqStatus = status as Prisma.EnumSiradiqStatusFilter["equals"];
  if (category) where.deductionCategory = category as Prisma.EnumDeductionCategoryFilter["equals"];

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      deductionCategory: true,
      providerCuit: true,
      providerName: true,
      invoiceType: true,
      invoiceNumber: true,
      invoiceDate: true,
      amount: true,
      fiscalYear: true,
      fiscalMonth: true,
      source: true,
      siradiqStatus: true,
      originalFilename: true,
      fileMimeType: true,
      createdAt: true,
      _count: { select: { automationJobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = invoices.map((inv) => ({
    ...inv,
    hasFile: !!inv.fileMimeType,
  }));

  return NextResponse.json({ invoices: result });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileBase64, fileMimeType, originalFilename, ...invoiceBody } = body;
    const parsed = createInvoiceSchema.safeParse(invoiceBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.invoiceNumber) {
      const duplicate = await prisma.invoice.findFirst({
        where: { userId: session.user.id, invoiceNumber: parsed.data.invoiceNumber },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Ya existe un comprobante con ese número" },
          { status: 409 }
        );
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: session.user.id,
        ...parsed.data,
        amount: new Prisma.Decimal(parsed.data.amount),
        source: fileBase64 ? "PDF" : "MANUAL",
        ...(fileBase64 ? {
          fileData: Buffer.from(fileBase64, "base64"),
          fileMimeType: fileMimeType || "application/octet-stream",
          originalFilename: originalFilename || null,
        } : {}),
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Error al crear factura" },
      { status: 500 }
    );
  }
}
