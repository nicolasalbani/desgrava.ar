"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregateImportProgress,
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
 */
export function useArcaImportProgress(options: UseArcaImportProgressOptions = {}) {
  const { pollIntervalMs = 4000 } = options;

  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_SNAPSHOT);
  const [summary, setSummary] = useState<ArcaImportSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const fiscalYear = new Date().getFullYear();

    async function tick() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok || cancelledRef.current) return;
        const data = (await res.json()) as { jobs: ApiJobLite[] };
        const { snapshot: snap, summary: summaryNext } = aggregateImportProgress(
          data.jobs,
          fiscalYear,
        );

        setSnapshot(snap);
        setSummary(summaryNext);
        setLoading(false);

        // Stop polling once everything is terminal.
        if (snap.allDone || (!snap.hasRunning && snap.trackedCount === 0)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (!intervalRef.current) {
          intervalRef.current = setInterval(tick, pollIntervalMs);
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
    };
  }, [pollIntervalMs]);

  return { snapshot, summary, loading };
}
