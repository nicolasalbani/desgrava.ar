import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PanelHeader } from "@/components/dashboard/panel-header";
import { JobCompletionRefresh } from "@/components/dashboard/job-completion-refresh";
import {
  MetricsRowSkeleton,
  MonthlyChartSkeleton,
  ProximoPasoSkeleton,
  RecentInvoicesSkeleton,
  SubscriptionCardSkeleton,
} from "@/components/dashboard/panel-skeletons";
import { MetricsSection } from "./_components/metrics-section";
import { ChartSection } from "./_components/chart-section";
import { ProximoPasoSection } from "./_components/proximo-paso-section";
import { RecientesSection } from "./_components/recientes-section";
import { SubscriptionSection } from "./_components/subscription-section";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "usuario";
  const fiscalYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PanelHeader firstName={firstName} fiscalYear={fiscalYear} />

      <Suspense fallback={<MetricsRowSkeleton />}>
        <MetricsSection userId={userId} fiscalYear={fiscalYear} />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Suspense fallback={<MonthlyChartSkeleton />}>
          <ChartSection userId={userId} fiscalYear={fiscalYear} />
        </Suspense>
        <Suspense fallback={<ProximoPasoSkeleton />}>
          <ProximoPasoSection userId={userId} fiscalYear={fiscalYear} />
        </Suspense>
      </div>

      <Suspense fallback={<RecentInvoicesSkeleton />}>
        <RecientesSection userId={userId} fiscalYear={fiscalYear} />
      </Suspense>

      <Suspense fallback={<SubscriptionCardSkeleton />}>
        <SubscriptionSection userId={userId} />
      </Suspense>

      <JobCompletionRefresh />
    </div>
  );
}
