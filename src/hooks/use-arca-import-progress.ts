"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregateImportProgress,
  computeQueueState,
  filterJobsBySessionCutoff,
  pickSessionCutoff,
  type ApiJobLite,
  type ArcaImportSummary,
  type QueueState,
  EMPTY_QUEUE_STATE,
  EMPTY_SNAPSHOT,
  EMPTY_SUMMARY,
} from "@/lib/onboarding/aggregate-progress";
import type { ProgressSnapshot } from "@/lib/onboarding/progress-stages";

export type { ArcaImportSummary, QueueState } from "@/lib/onboarding/aggregate-progress";

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

// ─── Optimistic job state ─────────────────────────────────────────────────
// To make the strip appear at click-time (not after the POST round-trip
// completes), `enqueueAutomationJob` synchronously injects a synthetic
// "running" job into a module-level slot before awaiting the network call.
// Every mounted hook merges this slot into its derivation, so the strip
// renders the running state immediately. Once the real job arrives on the
// next API tick, the slot auto-clears and the real data takes over.

/** Inputs needed to build an optimistic job: type + fiscal year. */
export interface OptimisticEnqueueInput {
  jobType: string;
  fiscalYear: number;
}

let optimisticJob: ApiJobLite | null = null;
let optimisticTimer: ReturnType<typeof setTimeout> | null = null;
const optimisticListeners = new Set<(job: ApiJobLite | null) => void>();

const OPTIMISTIC_ID_PREFIX = "__optimistic__";
const OPTIMISTIC_TIMEOUT_MS = 10_000;

function setOptimisticJob(job: ApiJobLite | null): void {
  optimisticJob = job;
  if (optimisticTimer) {
    clearTimeout(optimisticTimer);
    optimisticTimer = null;
  }
  if (job) {
    // Safety net: if the real job never arrives (POST hangs, network drops),
    // clear the optimistic state after a few seconds so the strip doesn't
    // get stuck pretending an automation is running.
    optimisticTimer = setTimeout(() => {
      setOptimisticJob(null);
    }, OPTIMISTIC_TIMEOUT_MS);
  }
  for (const fn of optimisticListeners) fn(job);
}

function buildOptimisticJob(input: OptimisticEnqueueInput): ApiJobLite {
  const now = new Date();
  return {
    id: `${OPTIMISTIC_ID_PREFIX}${now.getTime()}`,
    jobType: input.jobType,
    status: "RUNNING",
    // Every job type's first step is "login" (see JOB_TYPE_STEPS), so this
    // is a safe assumption. The real job's currentStep wins as soon as the
    // API tick replaces this.
    currentStep: "login",
    currentStepStartedAt: now.toISOString(),
    fiscalYear: input.fiscalYear,
    createdAt: now.toISOString(),
  };
}

/**
 * Try to derive `{ jobType, fiscalYear }` from a JSON request body so that
 * `enqueueAutomationJob` can fire its optimistic-state side-effect without
 * the caller having to spell it out. Returns `null` when the body shape
 * doesn't carry a string `jobType` (in which case the caller must pass an
 * explicit `optimistic` argument).
 *
 * Exported for unit testing.
 */
export function extractOptimisticInput(body?: object): OptimisticEnqueueInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.jobType !== "string" || record.jobType.length === 0) return null;
  const fiscalYear =
    typeof record.fiscalYear === "number" ? record.fiscalYear : new Date().getFullYear();
  return { jobType: record.jobType, fiscalYear };
}

/** True if the job is the synthetic optimistic placeholder. */
function isOptimistic(job: ApiJobLite): boolean {
  return job.id.startsWith(OPTIMISTIC_ID_PREFIX);
}

/**
 * Centralized helper for any client-side request that creates an automation
 * job. Side-effects (in order):
 *
 *  1. **Optimistic strip render**: synchronously injects a synthetic running
 *     job into module state so the strip appears the instant the user clicks,
 *     before any network round-trip. Derives `{ jobType, fiscalYear }` from
 *     the body when possible; pass `optimistic` explicitly for endpoints
 *     whose body doesn't carry a `jobType` (e.g. `/api/presentaciones/enviar`,
 *     `/api/credenciales/validar`).
 *  2. **POST**: fires the request with the given body as JSON.
 *  3. **Wake-up on success**: if `res.ok`, calls `refreshArcaProgress()` so
 *     every mounted hook re-polls and the optimistic state is replaced by
 *     the real job within one round-trip.
 *  4. **Cleanup on failure**: if the request fails, the optimistic state is
 *     cleared so the strip doesn't show a phantom job.
 *
 * Returns the `Response` unchanged for the caller to consume normally.
 *
 * Use this anywhere a request enqueues a job — raw `fetch` to those endpoints
 * is a foot-gun: the strip stays idle until something else nudges it.
 */
export async function enqueueAutomationJob(
  url: string,
  body?: object,
  optimistic?: OptimisticEnqueueInput,
): Promise<Response> {
  const opt = optimistic ?? extractOptimisticInput(body);
  if (opt) {
    setOptimisticJob(buildOptimisticJob(opt));
  }

  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (opt) setOptimisticJob(null);
    throw err;
  }

  if (res.ok) {
    refreshArcaProgress();
  } else if (opt) {
    setOptimisticJob(null);
  }
  return res;
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
  const [queueState, setQueueState] = useState<QueueState>(EMPTY_QUEUE_STATE);
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
  // Mirror of the module-level optimistic job slot. Read via ref so rederive
  // doesn't have to wait for a React render to see the latest value.
  const optimisticRef = useRef<ApiJobLite | null>(optimisticJob);

  useEffect(() => {
    cancelledRef.current = false;
    fiscalYearRef.current = new Date().getFullYear();

    function rederive() {
      const fy = fiscalYearRef.current;
      // Merge the optimistic job (if any) into the job list used for derivation
      // so the strip renders at click-time. **But only when nothing real is
      // already running** — if the strip is already in flight for some other
      // task, a new click should NOT disturb it (the new task will queue
      // silently on the server). The optimistic still lives in module state
      // so it gets auto-cleared when the real PENDING job lands.
      const baseJobs = cachedJobsRef.current;
      const hasRealRunning = baseJobs.some(
        (j) =>
          j.status === "RUNNING" &&
          (j.fiscalYear ?? fy) === fy &&
          !j.id.startsWith(OPTIMISTIC_ID_PREFIX),
      );
      const jobsForDerivation =
        optimisticRef.current && !hasRealRunning ? [optimisticRef.current, ...baseJobs] : baseJobs;

      const { cutoff, wasActive } = pickSessionCutoff(
        jobsForDerivation,
        fy,
        cutoffRef.current,
        wasActiveRef.current,
      );
      cutoffRef.current = cutoff;
      wasActiveRef.current = wasActive;

      const sessionJobs = filterJobsBySessionCutoff(jobsForDerivation, cutoff);
      const { snapshot: snap, summary: summaryNext } = aggregateImportProgress(
        sessionJobs,
        fy,
        Date.now(),
      );
      // queueState reads from the *unfiltered* job list (no session cutoff)
      // because non-tracked job types like SUBMIT_INVOICE don't participate in
      // the import session — they just need a "is anything active right now?"
      // signal for the strip and inline banner.
      const queue = computeQueueState(jobsForDerivation, fy, Date.now());
      setSnapshot(snap);
      setSummary(summaryNext);
      setQueueState(queue);

      // Stop the 1s ticker once nothing is in flight (tracked or otherwise).
      if (!snap.hasRunning && !queue.hasAnyActive && tickerRef.current) {
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

        // Auto-clear the module-level optimistic job once a real PENDING /
        // RUNNING job of the same type appears in the API response. We clear
        // for everyone (not just this hook instance) so a single tick from
        // any mounted hook drains the optimistic state globally.
        if (optimisticJob) {
          const matchesReal = data.jobs.some(
            (j) =>
              !isOptimistic(j) &&
              j.jobType === optimisticJob!.jobType &&
              (j.status === "PENDING" || j.status === "RUNNING"),
          );
          if (matchesReal) setOptimisticJob(null);
        }

        rederive();
        setLoading(false);

        const snap = aggregateImportProgress(
          cachedJobsRef.current,
          fiscalYearRef.current,
          Date.now(),
        ).snapshot;
        const queue = computeQueueState(cachedJobsRef.current, fiscalYearRef.current, Date.now());

        // Stop polling once everything is terminal — both for tracked imports
        // (snapshot) and for any other automation type (queueState).
        const trackedDone = snap.allDone || (!snap.hasRunning && snap.trackedCount === 0);
        if (trackedDone && !queue.hasAnyActive && !optimisticJob) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (!intervalRef.current) {
          intervalRef.current = setInterval(tick, pollIntervalMs);
        }

        // Start the 1s client-side re-derive interval while a job is running
        // (tracked or otherwise) so the indeterminate strip stays alive.
        if ((snap.hasRunning || queue.hasAnyActive || optimisticJob) && !tickerRef.current) {
          tickerRef.current = setInterval(rederive, 1000);
        }
      } catch {
        // Silently ignore fetch errors — try again on next tick.
      }
    }

    function onOptimisticChange(job: ApiJobLite | null) {
      optimisticRef.current = job;
      // Synchronous rederive so the strip switches into running state in the
      // same task as the click — no waiting for setState scheduling.
      //
      // We deliberately do NOT fire a `tick()` here even when a job is set:
      // the POST that triggered this optimistic hasn't committed server-side
      // yet, so any GET fired now would return stale data. The post-POST
      // `refreshArcaProgress()` from `enqueueAutomationJob` fires a tick at
      // the right time. Firing one here would race that one — if the stale
      // GET happens to return AFTER the post-POST GET, it overwrites
      // `cachedJobsRef.current` with old data and the strip flickers off
      // until the next 4s poll cycle.
      rederive();
    }

    // Sync the initial value in case `optimisticJob` was set by a click that
    // happened just before this hook mounted (e.g. between page navigations).
    optimisticRef.current = optimisticJob;

    tick();
    tickListeners.add(tick);
    optimisticListeners.add(onOptimisticChange);

    return () => {
      cancelledRef.current = true;
      tickListeners.delete(tick);
      optimisticListeners.delete(onOptimisticChange);
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

  return { snapshot, summary, queueState, loading };
}
