import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuit = req.nextUrl.searchParams.get("cuit");
  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return NextResponse.json({ error: "CUIT invalido" }, { status: 400 });
  }

  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      userId: session.user.id,
      providerCuit: cuit,
    },
    orderBy: { createdAt: "desc" },
    select: { deductionCategory: true },
  });

  return NextResponse.json({
    category: lastInvoice?.deductionCategory ?? null,
  });
}
