"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregateImportProgress,
  filterJobsBySessionCutoff,
  pickSessionCutoff,
  type ApiJobLite,
  type ArcaImportSummary,
  EMPTY_SNAPSHOT,
  EMPTY_SUMMARY,
} from "@/lib/onboarding/aggregate-progress";
import type { ProgressSnapshot } from "@/lib/onboarding/progress-stages";

export type { ArcaImportSummary } from "@/lib/onboarding/aggregate-progress";

interface UseArcaImportProgressOptions {
  /** Poll cadence in ms while jobs are active. */
  pollIntervalMs?: number;
}

// Module-level pubsub so callers that enqueue a new ARCA job (e.g. clicking
// "Importar desde ARCA") can wake every idle hook instance — the strip,
// the button itself, list pages — without waiting for the next 4s tick or
// for a route change to remount them.
const tickListeners = new Set<() => void>();

/** Forces every mounted `useArcaImportProgress` instance to poll once now.
 *  Call this after a successful `POST /api/automatizacion` so the strip and
 *  the import button switch into running state immediately. */
export function refreshArcaProgress() {
  for (const fn of tickListeners) fn();
}

/**
 * Polls /api/automatizacion and exposes an aggregated progress snapshot for the
 * post-onboarding ARCA imports (PULL_COMPROBANTES, PULL_DOMESTIC_RECEIPTS,
 * PULL_PRESENTACIONES, plus leftover PULL_PROFILE). Used by the persistent
 * progress strip and the disabled "Importar desde ARCA" button on the
 * Próximo paso card so they stay in sync.
 *
 * In addition to the 4s API poll, the hook re-derives the snapshot every 1s
 * against the cached job list using the current wall clock. This keeps the
 * bar visibly creeping while a long-running step is in flight (the percent
 * is time-weighted, so the in-flight partial weight grows continuously).
 */
export function useArcaImportProgress(options: UseArcaImportProgressOptions = {}) {
  const { pollIntervalMs = 4000 } = options;

  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_SNAPSHOT);
  const [summary, setSummary] = useState<ArcaImportSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cachedJobsRef = useRef<ApiJobLite[]>([]);
  const fiscalYearRef = useRef<number>(new Date().getFullYear());
  const cancelledRef = useRef(false);
  // Session cutoff: locks to the earliest `createdAt` among active tracked jobs
  // when entering active state. Filters cached jobs so the strip's percent
  // reflects only the current import session, not historical completed jobs.
  const cutoffRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    fiscalYearRef.current = new Date().getFullYear();

    function rederive() {
      const fy = fiscalYearRef.current;
      const { cutoff, wasActive } = pickSessionCutoff(
        cachedJobsRef.current,
        fy,
        cutoffRef.current,
        wasActiveRef.current,
      );
      cutoffRef.current = cutoff;
      wasActiveRef.current = wasActive;

      const sessionJobs = filterJobsBySessionCutoff(cachedJobsRef.current, cutoff);
      const { snapshot: snap, summary: summaryNext } = aggregateImportProgress(
        sessionJobs,
        fy,
        Date.now(),
      );
      setSnapshot(snap);
      setSummary(summaryNext);

      // Stop the 1s ticker once nothing is in flight.
      if (!snap.hasRunning && tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }

    async function tick() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok || cancelledRef.current) return;
        const data = (await res.json()) as { jobs: ApiJobLite[] };
        cachedJobsRef.current = data.jobs;
        rederive();
        setLoading(false);

        const snap = aggregateImportProgress(
          cachedJobsRef.current,
          fiscalYearRef.current,
          Date.now(),
        ).snapshot;

        // Stop polling once everything is terminal.
        if (snap.allDone || (!snap.hasRunning && snap.trackedCount === 0)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (!intervalRef.current) {
          intervalRef.current = setInterval(tick, pollIntervalMs);
        }

        // Start the 1s client-side re-derive interval while a job is running.
        if (snap.hasRunning && !tickerRef.current) {
          tickerRef.current = setInterval(rederive, 1000);
        }
      } catch {
        // Silently ignore fetch errors — try again on next tick.
      }
    }

    tick();
    tickListeners.add(tick);

    return () => {
      cancelledRef.current = true;
      tickListeners.delete(tick);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [pollIntervalMs]);

  return { snapshot, summary, loading };
}
