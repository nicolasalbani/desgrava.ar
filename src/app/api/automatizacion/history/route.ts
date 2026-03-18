import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/automatizacion/history?invoiceId=xxx or ?receiptId=xxx
 * Returns all automation jobs linked to a specific invoice or receipt.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  const receiptId = req.nextUrl.searchParams.get("receiptId");

  if (!invoiceId && !receiptId) {
    return NextResponse.json({ error: "Se requiere invoiceId o receiptId" }, { status: 400 });
  }

  if (invoiceId) {
    const jobs = await prisma.automationJob.findMany({
      where: {
        invoiceId,
        userId: session.user.id,
        jobType: "SUBMIT_INVOICE",
      },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        logs: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ jobs });
  }

  // receiptId: find jobs via m2m relation
  const jobs = await prisma.automationJob.findMany({
    where: {
      domesticReceipts: { some: { id: receiptId! } },
      userId: session.user.id,
      jobType: "SUBMIT_DOMESTIC_DEDUCTION",
    },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
      logs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ jobs });
}
