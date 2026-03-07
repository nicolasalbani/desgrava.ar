"use client";

import { FiscalYearProvider } from "@/contexts/fiscal-year";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DeadlineBanner } from "./deadline-banner";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <FiscalYearProvider>
      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <DeadlineBanner />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </FiscalYearProvider>
  );
}
