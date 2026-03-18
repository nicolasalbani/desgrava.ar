"use client";

import { FiscalYearProvider } from "@/contexts/fiscal-year";
import { AttentionCountsProvider } from "@/contexts/attention-counts";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DeadlineBanner } from "./deadline-banner";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <FiscalYearProvider>
      <AttentionCountsProvider>
        <div className="flex h-screen overflow-hidden">
          <DashboardSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <DashboardHeader />
            <DeadlineBanner />
            <main className="bg-muted/30 flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </AttentionCountsProvider>
    </FiscalYearProvider>
  );
}
