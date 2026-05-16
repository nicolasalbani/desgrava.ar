import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import { getSiradigEffectiveRate } from "@/lib/simulador/deduction-rules";
import { ProximoPasoCard } from "@/components/dashboard/proximo-paso-card";

interface ProximoPasoSectionProps {
  userId: string;
  fiscalYear: number;
}

export async function ProximoPasoSection({ userId, fiscalYear }: ProximoPasoSectionProps) {
  const [
    totalDeducibleInvoices,
    totalDeducibleReceipts,
    pendingInvoiceCount,
    pendingReceiptCount,
    unregisteredWorkerReceipt,
    monthCategoryBreakdown,
    receiptMonthBreakdown,
    yearPreference,
    latestPresentacion,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { userId, fiscalYear, deductionCategory: { not: "NO_DEDUCIBLE" } },
    }),
    prisma.domesticReceipt.count({
      where: { userId, fiscalYear },
    }),
    prisma.invoice.count({
      where: {
        userId,
        fiscalYear,
        deductionCategory: { not: "NO_DEDUCIBLE" },
        siradiqStatus: { in: ["PENDING", "QUEUED", "PROCESSING", "FAILED"] },
      },
    }),
    prisma.domesticReceipt.count({
      where: {
        userId,
        fiscalYear,
        siradiqStatus: { in: ["PENDING", "QUEUED", "PROCESSING", "FAILED"] },
      },
    }),
    prisma.domesticReceipt.findFirst({
      where: { userId, fiscalYear, domesticWorkerId: null },
      select: { id: true },
    }),
    prisma.invoice.groupBy({
      by: ["deductionCategory"],
      where: {
        userId,
        fiscalYear,
        siradiqStatus: "SUBMITTED",
        deductionCategory: { not: "NO_DEDUCIBLE" },
      },
      _sum: { amount: true },
    }),
    prisma.domesticReceipt.groupBy({
      by: ["fiscalMonth"],
      where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" },
      _sum: { total: true, contributionAmount: true },
    }),
    prisma.userYearPreference.findUnique({
      where: { userId_fiscalYear: { userId, fiscalYear } },
      select: { ownsProperty: true },
    }),
    prisma.presentacion.findFirst({
      where: { userId, fiscalYear },
      orderBy: { numero: "desc" },
      select: { montoTotal: true },
    }),
  ]);

  const ownsProperty = yearPreference?.ownsProperty ?? false;

  const invoiceTotal = monthCategoryBreakdown.reduce((sum, entry) => {
    const raw = entry._sum.amount ? new Decimal(entry._sum.amount.toString()) : new Decimal(0);
    const rate = getSiradigEffectiveRate(entry.deductionCategory, ownsProperty);
    return sum.plus(raw.mul(rate));
  }, new Decimal(0));

  const receiptTotal = receiptMonthBreakdown.reduce((sum, entry) => {
    const total = entry._sum.total ? new Decimal(entry._sum.total.toString()) : new Decimal(0);
    const contribution = entry._sum.contributionAmount
      ? new Decimal(entry._sum.contributionAmount.toString())
      : new Decimal(0);
    return sum.plus(total).plus(contribution);
  }, new Decimal(0));

  const totalDeducted = invoiceTotal.plus(receiptTotal).toDP(2).toNumber();
  const hasUnregisteredWorker = unregisteredWorkerReceipt !== null;
  const allSubmitted =
    totalDeducibleInvoices + totalDeducibleReceipts > 0 &&
    pendingInvoiceCount === 0 &&
    pendingReceiptCount === 0;

  const lastPresentacionMontoTotal = latestPresentacion?.montoTotal
    ? new Decimal(latestPresentacion.montoTotal.toString()).toDP(2).toNumber()
    : null;

  return (
    <ProximoPasoCard
      pendingInvoiceCount={pendingInvoiceCount}
      pendingReceiptCount={pendingReceiptCount}
      totalDeducibleInvoices={totalDeducibleInvoices}
      totalDeducibleReceipts={totalDeducibleReceipts}
      hasUnregisteredWorker={hasUnregisteredWorker}
      allSubmitted={allSubmitted}
      fiscalYear={fiscalYear}
      totalDeducted={totalDeducted}
      lastPresentacionMontoTotal={lastPresentacionMontoTotal}
    />
  );
}
