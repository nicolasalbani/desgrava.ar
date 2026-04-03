"use client";

import { FiscalYearProvider } from "@/contexts/fiscal-year";
import { AttentionCountsProvider } from "@/contexts/attention-counts";
import { DomesticWorkerCountProvider } from "@/contexts/domestic-worker-count";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DeadlineBanner } from "./deadline-banner";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { SupportChatButton } from "@/components/soporte/support-chat-button";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <FiscalYearProvider>
      <AttentionCountsProvider>
        <DomesticWorkerCountProvider>
          <div className="flex h-screen overflow-hidden">
            <DashboardSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <DashboardHeader />
              <SubscriptionBanner />
              <DeadlineBanner />
              <main className="bg-muted/30 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
          <SupportChatButton />
        </DomesticWorkerCountProvider>
      </AttentionCountsProvider>
    </FiscalYearProvider>
  );
}
