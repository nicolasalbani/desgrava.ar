import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEDUCTION_CATEGORIES } from "@/lib/validators/invoice";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { invoiceIds, deductionCategory } = await req.json();

    if (
      !Array.isArray(invoiceIds) ||
      invoiceIds.length === 0 ||
      invoiceIds.some((id: unknown) => typeof id !== "string")
    ) {
      return NextResponse.json({ error: "invoiceIds inválidos" }, { status: 400 });
    }

    if (
      !deductionCategory ||
      !(DEDUCTION_CATEGORIES as readonly string[]).includes(deductionCategory)
    ) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    // Update all invoices belonging to this user
    const result = await prisma.invoice.updateMany({
      where: {
        id: { in: invoiceIds },
        userId: session.user.id,
      },
      data: { deductionCategory },
    });

    // If all selected invoices share the same provider CUIT, update the catalog
    if (result.count > 0) {
      const distinctCuits = await prisma.invoice.groupBy({
        by: ["providerCuit"],
        where: {
          id: { in: invoiceIds },
          userId: session.user.id,
        },
      });

      if (distinctCuits.length === 1) {
        const cuit = distinctCuits[0].providerCuit;
        await prisma.providerCatalog.upsert({
          where: { cuit },
          create: {
            cuit,
            deductionCategory,
            source: "MANUAL",
          },
          update: {
            deductionCategory,
            source: "MANUAL",
          },
        });
      }
    }

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Error in bulk category update:", error);
    return NextResponse.json({ error: "Error al actualizar categorías" }, { status: 500 });
  }
}
