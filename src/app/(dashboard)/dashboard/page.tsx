import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import { Decimal } from "decimal.js";
import { getSiradigEffectiveRate } from "@/lib/simulador/deduction-rules";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuario";
  const fiscalYear = new Date().getFullYear();

  const [
    totalInvoices,
    submittedCount,
    pendingCount,
    monthCategoryBreakdown,
    subscription,
    yearPreference,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { userId, fiscalYear, deductionCategory: { not: "NO_DEDUCIBLE" } },
    }),
    prisma.invoice.count({
      where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" },
    }),
    prisma.invoice.count({
      where: {
        userId,
        fiscalYear,
        deductionCategory: { not: "NO_DEDUCIBLE" },
        siradiqStatus: { in: ["PENDING", "QUEUED", "PROCESSING"] },
      },
    }),
    // Group by month AND category for the stacked chart
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
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.userYearPreference.findUnique({
      where: { userId_fiscalYear: { userId, fiscalYear } },
      select: { ownsProperty: true },
    }),
  ]);

  const ownsProperty = yearPreference?.ownsProperty ?? false;

  // Build month×category data applying SiRADIG effective rates.
  // SiRADIG applies percentage rates to certain categories (e.g. 40% for GASTOS_MEDICOS),
  // so the dashboard must reflect the same amounts as the F.572 PDF total.
  const monthCategoryData = monthCategoryBreakdown.map((entry) => {
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

  const totalDeducted = monthCategoryData
    .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
    .toDP(2)
    .toNumber();

  const estimatedSavings = new Decimal(totalDeducted).mul(0.35).toDP(2).toNumber();

  return (
    <MetricsPanel
      firstName={firstName}
      fiscalYear={fiscalYear}
      totalDeducted={totalDeducted}
      estimatedSavings={estimatedSavings}
      totalInvoices={totalInvoices}
      submittedCount={submittedCount}
      pendingCount={pendingCount}
      monthCategoryData={monthCategoryData}
      subscription={
        subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              trialEndDate: subscription.trialEndDate?.toISOString() ?? null,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
