import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import { Decimal } from "decimal.js";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuario";
  const fiscalYear = new Date().getFullYear();

  const [
    totalInvoices,
    submittedCount,
    pendingCount,
    submittedTotal,
    monthCategoryBreakdown,
    subscription,
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
    prisma.invoice.aggregate({
      where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" },
      _sum: { amount: true },
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
  ]);

  const totalDeducted = submittedTotal._sum.amount
    ? new Decimal(submittedTotal._sum.amount.toString()).toNumber()
    : 0;

  const estimatedSavings = new Decimal(totalDeducted).mul(0.35).toDP(2).toNumber();

  // Build month×category data
  const monthCategoryData = monthCategoryBreakdown.map((entry) => ({
    month: entry.fiscalMonth,
    category: entry.deductionCategory,
    amount: entry._sum.amount ? new Decimal(entry._sum.amount.toString()).toNumber() : 0,
  }));

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
