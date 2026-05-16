import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import { getSiradigEffectiveRate } from "@/lib/simulador/deduction-rules";
import { MetricsRow } from "@/components/dashboard/metrics-row";

interface MetricsSectionProps {
  userId: string;
  fiscalYear: number;
}

export async function MetricsSection({ userId, fiscalYear }: MetricsSectionProps) {
  const [
    totalInvoices,
    submittedInvoiceCount,
    submittedReceiptCount,
    pendingInvoiceCount,
    pendingReceiptCount,
    monthCategoryBreakdown,
    receiptMonthBreakdown,
    yearPreference,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { userId, fiscalYear, deductionCategory: { not: "NO_DEDUCIBLE" } },
    }),
    prisma.invoice.count({
      where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" },
    }),
    prisma.domesticReceipt.count({
      where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" },
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
  const estimatedSavings = new Decimal(totalDeducted).mul(0.35).toDP(2).toNumber();
  const submittedCount = submittedInvoiceCount + submittedReceiptCount;
  const pendingCount = pendingInvoiceCount + pendingReceiptCount;

  return (
    <MetricsRow
      totalDeducted={totalDeducted}
      totalInvoices={totalInvoices}
      estimatedSavings={estimatedSavings}
      pendingCount={pendingCount}
      submittedCount={submittedCount}
    />
  );
}
