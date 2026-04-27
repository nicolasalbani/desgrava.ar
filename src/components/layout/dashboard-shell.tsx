"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiscalYearProvider } from "@/contexts/fiscal-year";
import { AttentionCountsProvider } from "@/contexts/attention-counts";
import { DomesticWorkerCountProvider } from "@/contexts/domestic-worker-count";
import { EmployerCountProvider } from "@/contexts/employer-count";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DeadlineBanner } from "./deadline-banner";
import { ArcaProgressStrip } from "./arca-progress-strip";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { SupportChatButton } from "@/components/soporte/support-chat-button";
import { GuidedOnboarding } from "@/components/onboarding/guided-onboarding";
import { DashboardTour } from "@/components/onboarding/dashboard-tour";
import { TourReplayButton } from "@/components/onboarding/tour-replay-button";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  onboardingCompleted: initialOnboardingCompleted,
  tourSeen,
  firstName,
}: {
  children: React.ReactNode;
  onboardingCompleted: boolean;
  tourSeen: boolean;
  firstName: string;
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

  // Force providers to remount after onboarding so they refetch fresh counts
  const providerKey = onboardingCompleted ? "ready" : "onboarding";
  const fiscalYear = new Date().getFullYear();
  const showTour = onboardingCompleted && !tourSeen;

  return (
    <FiscalYearProvider>
      <AttentionCountsProvider key={providerKey}>
        <DomesticWorkerCountProvider key={providerKey}>
          <EmployerCountProvider key={providerKey}>
            {!onboardingCompleted && <GuidedOnboarding onComplete={handleOnboardingComplete} />}
            <div
              className={cn(
                "flex h-dvh flex-col overflow-hidden transition-opacity duration-700",
                !showDashboard && "pointer-events-none opacity-0",
              )}
            >
              <ArcaProgressStrip />
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <DashboardSidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                  <DashboardHeader />
                  <SubscriptionBanner />
                  <DeadlineBanner />
                  <main className="bg-muted/30 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
                </div>
              </div>
            </div>
            {showDashboard && <SupportChatButton />}
            {showDashboard && tourSeen && <TourReplayButton />}
            {showDashboard && showTour && (
              <DashboardTour fiscalYear={fiscalYear} firstName={firstName} />
            )}
          </EmployerCountProvider>
        </DomesticWorkerCountProvider>
      </AttentionCountsProvider>
    </FiscalYearProvider>
  );
}
