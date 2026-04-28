import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogEntry } from "@/lib/catalog/provider-catalog";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuit = req.nextUrl.searchParams.get("cuit");
  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return NextResponse.json({ error: "CUIT invalido" }, { status: 400 });
  }

  // 1. Check per-user last invoice first (preserves manual reclassifications)
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      userId: session.user.id,
      providerCuit: cuit,
    },
    orderBy: { createdAt: "desc" },
    select: { deductionCategory: true },
  });

  if (lastInvoice) {
    return NextResponse.json({ category: lastInvoice.deductionCategory });
  }

  // 2. Fall back to global provider catalog
  const catalogEntry = await getCatalogEntry(cuit);

  return NextResponse.json({
    category: catalogEntry?.deductionCategory ?? null,
  });
}
