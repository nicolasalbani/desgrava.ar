import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validators/invoice";
import { Prisma } from "@/generated/prisma/client";
import { matchDependent, buildInvoiceText } from "@/lib/matching/dependent-matcher";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ invoice });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.invoice.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(parsed.data.amount);
    }

    // Handle category change: clear dependent link if switching away from education
    const newCategory = parsed.data.deductionCategory ?? existing.deductionCategory;
    if (newCategory !== "GASTOS_EDUCATIVOS") {
      updateData.familyDependentId = null;
    } else if (
      parsed.data.deductionCategory === "GASTOS_EDUCATIVOS" &&
      existing.deductionCategory !== "GASTOS_EDUCATIVOS" &&
      !parsed.data.familyDependentId
    ) {
      // Switching TO education: attempt auto-link
      const dependents = await prisma.familyDependent.findMany({
        where: {
          userId: session.user.id,
          fiscalYear: parsed.data.fiscalYear ?? existing.fiscalYear,
        },
        select: { id: true, nombre: true, apellido: true },
      });
      const text = buildInvoiceText({
        description: parsed.data.description ?? existing.description,
        providerName: parsed.data.providerName ?? existing.providerName,
      });
      const result = matchDependent(text, dependents);
      updateData.familyDependentId = result.dependentId;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: "Error al actualizar factura" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.invoice.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  // Delete linked automation jobs first, then the invoice
  await prisma.automationJob.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
