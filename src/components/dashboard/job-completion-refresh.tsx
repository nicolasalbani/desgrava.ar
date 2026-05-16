"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DASHBOARD_RELEVANT_JOB_TYPES = new Set([
  "PULL_COMPROBANTES",
  "PULL_DOMESTIC_WORKERS",
  "PULL_DOMESTIC_RECEIPTS",
  "SUBMIT_INVOICE",
  "SUBMIT_DOMESTIC_DEDUCTION",
]);

/** When any of the dashboard-relevant automation jobs transitions from
 *  active → terminal, call `router.refresh()` so the streamed server
 *  components on `/panel` re-render with fresh data. */
export function JobCompletionRefresh() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let hadActiveJobs = false;

    async function checkJobs() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok || cancelled) return;
        const { jobs } = await res.json();

        const hasActive = jobs.some(
          (j: { jobType: string; status: string }) =>
            DASHBOARD_RELEVANT_JOB_TYPES.has(j.jobType) &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );

        if (hasActive) {
          hadActiveJobs = true;
          if (!interval) {
            interval = setInterval(checkJobs, 4000);
          }
        } else if (hadActiveJobs) {
          hadActiveJobs = false;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          router.refresh();
        }
      } catch {
        // Silently ignore fetch errors
      }
    }

    checkJobs();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [router]);

  return null;
}
