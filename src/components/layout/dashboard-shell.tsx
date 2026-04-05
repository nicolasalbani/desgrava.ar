"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiscalYearProvider } from "@/contexts/fiscal-year";
import { AttentionCountsProvider } from "@/contexts/attention-counts";
import { DomesticWorkerCountProvider } from "@/contexts/domestic-worker-count";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DeadlineBanner } from "./deadline-banner";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { SupportChatButton } from "@/components/soporte/support-chat-button";
import { GuidedOnboarding } from "@/components/onboarding/guided-onboarding";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  onboardingCompleted: initialOnboardingCompleted,
}: {
  children: React.ReactNode;
  onboardingCompleted: boolean;
}) {
  const router = useRouter();
  const [onboardingCompleted, setOnboardingCompleted] = useState(initialOnboardingCompleted);
  const [showDashboard, setShowDashboard] = useState(initialOnboardingCompleted);

  function handleOnboardingComplete() {
    setOnboardingCompleted(true);
    // Re-run server components to fetch fresh dashboard data
    // (the initial render had stale/empty data from before onboarding)
    router.refresh();
    setShowDashboard(true);
  }

  return (
    <FiscalYearProvider>
      <AttentionCountsProvider>
        <DomesticWorkerCountProvider>
          {!onboardingCompleted && <GuidedOnboarding onComplete={handleOnboardingComplete} />}
          <div
            className={cn(
              "flex h-screen overflow-hidden transition-opacity duration-700",
              !showDashboard && "pointer-events-none opacity-0",
            )}
          >
            <DashboardSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <DashboardHeader />
              <SubscriptionBanner />
              <DeadlineBanner />
              <main className="bg-muted/30 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
          {showDashboard && <SupportChatButton />}
        </DomesticWorkerCountProvider>
      </AttentionCountsProvider>
    </FiscalYearProvider>
  );
}
