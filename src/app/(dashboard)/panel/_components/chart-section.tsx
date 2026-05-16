import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import { getSiradigEffectiveRate } from "@/lib/simulador/deduction-rules";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";

interface ChartSectionProps {
  userId: string;
  fiscalYear: number;
}

export async function ChartSection({ userId, fiscalYear }: ChartSectionProps) {
  const [monthCategoryBreakdown, receiptMonthBreakdown, yearPreference] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["fiscalMonth", "deductionCategory"],
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

  const invoiceEntries = monthCategoryBreakdown.map((entry) => {
    const rawAmount = entry._sum.amount
      ? new Decimal(entry._sum.amount.toString())
      : new Decimal(0);
    const rate = getSiradigEffectiveRate(entry.deductionCategory, ownsProperty);
    return {
      month: entry.fiscalMonth,
      category: entry.deductionCategory,
      amount: rawAmount.mul(rate).toDP(2).toNumber(),
    };
  });

  const receiptEntries = receiptMonthBreakdown.map((entry) => {
    const total = entry._sum.total ? new Decimal(entry._sum.total.toString()) : new Decimal(0);
    const contribution = entry._sum.contributionAmount
      ? new Decimal(entry._sum.contributionAmount.toString())
      : new Decimal(0);
    return {
      month: entry.fiscalMonth,
      category: "SERVICIO_DOMESTICO",
      amount: total.plus(contribution).toDP(2).toNumber(),
    };
  });

  const mergedByKey = new Map<string, { month: number; category: string; amount: number }>();
  for (const entry of [...invoiceEntries, ...receiptEntries]) {
    const key = `${entry.month}:${entry.category}`;
    const existing = mergedByKey.get(key);
    if (existing) {
      existing.amount = new Decimal(existing.amount).plus(entry.amount).toDP(2).toNumber();
    } else {
      mergedByKey.set(key, { ...entry });
    }
  }
  const monthCategoryData = Array.from(mergedByKey.values());

  return <MonthlyChart monthCategoryData={monthCategoryData} fiscalYear={fiscalYear} />;
}
