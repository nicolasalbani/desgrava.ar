import {
  computeJobPercent,
  computeProgressSnapshot,
  TRACKED_JOB_TYPES,
  type JobLite,
  type ProgressSnapshot,
} from "@/lib/onboarding/progress-stages";

export interface QueueState {
  /** True when the user has at least one PENDING or RUNNING job (any type). */
  hasAnyActive: boolean;
  /** Type of the single RUNNING job. The server enforces ≤ 1 RUNNING per user
   *  via a Redis lock, so this is a single value. Null when the user has only
   *  PENDING jobs (worker-pool saturation). */
  runningJobType: string | null;
  /** Time-weighted percent for the single RUNNING job, regardless of whether
   *  the job type is tracked by the import snapshot. Null when no job is
   *  running, or when the running job's type has no `JOB_STEP_DURATIONS`
   *  entries (the strip falls back to indeterminate UI). */
  runningJobPercent: number | null;
  /** True when **more than one** automation is active — a RUNNING job plus
   *  one or more PENDING, or two-plus PENDING with nothing running yet (rare
   *  worker-saturation case). Used to surface the "más automatizaciones
   *  esperando" hint, so it must be false when there's only a single in-
   *  flight job (otherwise the copy lies). */
  hasQueuedWaiting: boolean;
  /** Unique list of PENDING job types. Consumers use this to decide whether
   *  to mount the inline banner (e.g., only show the comprobantes banner when
   *  there's a queued SUBMIT_INVOICE / BULK_SUBMIT). */
  queuedJobTypes: ReadonlyArray<string>;
}

export const EMPTY_QUEUE_STATE: QueueState = {
  hasAnyActive: false,
  runningJobType: null,
  runningJobPercent: null,
  hasQueuedWaiting: false,
  queuedJobTypes: [],
};

export interface ApiJobLite {
  id: string;
  jobType: string;
  status: JobLite["status"];
  currentStep: string | null;
  currentStepStartedAt?: string | null;
  fiscalYear: number | null;
  createdAt: string;
  resultData?: unknown;
}

export interface ArcaImportSummary {
  invoices: number;
  receipts: number;
  presentaciones: number;
}

export const EMPTY_SNAPSHOT: ProgressSnapshot = {
  stage: "done",
  stageLabel: "Listo",
  percent: 0,
  percentByType: {
    PULL_COMPROBANTES: 0,
    PULL_DOMESTIC_RECEIPTS: 0,
    PULL_PRESENTACIONES: 0,
    PULL_PROFILE: 0,
  },
  hasFailed: false,
  hasRunning: false,
  allDone: true,
  trackedCount: 0,
  completedTypes: [],
  runningTypes: [],
};

export const EMPTY_SUMMARY: ArcaImportSummary = {
  invoices: 0,
  receipts: 0,
  presentaciones: 0,
};

const TRACKED_SET = new Set<string>(TRACKED_JOB_TYPES);

function isActiveStatus(s: JobLite["status"]): boolean {
  return s === "PENDING" || s === "RUNNING";
}

/**
 * Decides the session cutoff (earliest createdAt of any active tracked job).
 * Locks on transition into "active" state so completed jobs from previous
 * sessions don't bias the strip's percent. Returns the new `(cutoff, wasActive)`
 * pair which the caller stores in refs and feeds back next call.
 *
 * Behavior:
 * - prev=inactive → active: cutoff is set to earliest active createdAt
 * - prev=active → still active: cutoff is preserved (a job completing mid-session
 *   keeps contributing to the bar)
 * - prev=active → inactive: cutoff is preserved (post-completion success view)
 * - prev=inactive → still inactive: cutoff stays as it was (typically null)
 */
export function pickSessionCutoff(
  jobs: ApiJobLite[],
  fiscalYear: number,
  prevCutoff: number | null,
  prevWasActive: boolean,
): { cutoff: number | null; wasActive: boolean } {
  const tracked = jobs.filter(
    (j) => TRACKED_SET.has(j.jobType) && (j.fiscalYear ?? fiscalYear) === fiscalYear,
  );
  const active = tracked.filter((j) => isActiveStatus(j.status));
  const isActiveNow = active.length > 0;

  if (isActiveNow && !prevWasActive) {
    const earliest = Math.min(...active.map((j) => new Date(j.createdAt).getTime()));
    return { cutoff: earliest, wasActive: true };
  }

  return { cutoff: prevCutoff, wasActive: isActiveNow };
}

/** Filters jobs to those whose `createdAt >= cutoff`. Returns `[]` when cutoff
 *  is null so the caller doesn't accidentally include stale jobs. */
export function filterJobsBySessionCutoff(jobs: ApiJobLite[], cutoff: number | null): ApiJobLite[] {
  if (cutoff === null) return [];
  return jobs.filter((j) => new Date(j.createdAt).getTime() >= cutoff);
}

/**
 * Pure aggregator: filters the /api/automatizacion job list to tracked types
 * for the given fiscal year, picks the latest job per type, and returns
 * the high-level progress snapshot plus the import summary counts.
 *
 * `now` lets the caller re-derive the snapshot against the current wall clock
 * without re-fetching the API — the hook re-computes every second so the
 * in-flight partial-step weight keeps the bar moving smoothly.
 */
export function aggregateImportProgress(
  jobs: ApiJobLite[],
  fiscalYear: number,
  now: number = Date.now(),
): { snapshot: ProgressSnapshot; summary: ArcaImportSummary } {
  const tracked = jobs.filter(
    (j) => TRACKED_SET.has(j.jobType) && (j.fiscalYear ?? fiscalYear) === fiscalYear,
  );

  // Most recent job of each type wins. The /api/automatizacion endpoint orders
  // by createdAt desc, so the first-seen of a type is the latest.
  const latestByType = new Map<string, ApiJobLite>();
  for (const j of tracked) {
    if (!latestByType.has(j.jobType)) latestByType.set(j.jobType, j);
  }

  const lite: JobLite[] = Array.from(latestByType.values()).map((j) => ({
    jobType: j.jobType,
    status: j.status,
    currentStep: j.currentStep,
    currentStepStartedAt: j.currentStepStartedAt ? new Date(j.currentStepStartedAt) : null,
  }));

  const snapshot = computeProgressSnapshot(lite, now);

  const summary: ArcaImportSummary = { invoices: 0, receipts: 0, presentaciones: 0 };
  for (const j of latestByType.values()) {
    if (j.status !== "COMPLETED") continue;
    const result = (j.resultData ?? null) as {
      importedCount?: number;
      receiptsCount?: number;
      presentacionesCount?: number;
    } | null;
    if (j.jobType === "PULL_COMPROBANTES") {
      summary.invoices = result?.importedCount ?? 0;
    } else if (j.jobType === "PULL_DOMESTIC_RECEIPTS") {
      summary.receipts = result?.receiptsCount ?? 0;
    } else if (j.jobType === "PULL_PRESENTACIONES") {
      summary.presentaciones = result?.presentacionesCount ?? 0;
    }
  }

  return { snapshot, summary };
}

/**
 * Pure helper that derives the queue state across **every** job type — not
 * just tracked imports — for the user's current fiscal year. Reads the same
 * `/api/automatizacion` job list that the import-progress aggregator uses, so
 * no extra fetch is needed.
 *
 * Filters jobs to the given fiscal year (jobs with `fiscalYear == null` are
 * treated as belonging to the current year — matches the import aggregator).
 * The latest job per `(jobType, ...)` is **not** deduped here because we want
 * the full queue depth: if a user fires three `SUBMIT_INVOICE` jobs back-to-
 * back, all three count as queued (one runs, two wait).
 */
export function computeQueueState(
  jobs: ApiJobLite[],
  fiscalYear: number,
  now: number = Date.now(),
): QueueState {
  const inScope = jobs.filter((j) => (j.fiscalYear ?? fiscalYear) === fiscalYear);
  const running = inScope.filter((j) => j.status === "RUNNING");
  const pending = inScope.filter((j) => j.status === "PENDING");

  if (running.length === 0 && pending.length === 0) {
    return EMPTY_QUEUE_STATE;
  }

  // Per-user lock invariant: ≤ 1 RUNNING. Fall back to first-by-createdAt-asc
  // deterministically if the invariant ever breaks.
  const runningJob =
    running.length > 0
      ? [...running].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0]
      : null;
  const runningJobType = runningJob?.jobType ?? null;

  // Time-weighted percent for the single running job. Reuses the same math as
  // the import snapshot but works for any job type that has duration data.
  const runningJobPercent = runningJob
    ? computeJobPercent(
        {
          jobType: runningJob.jobType,
          status: runningJob.status,
          currentStep: runningJob.currentStep,
          currentStepStartedAt: runningJob.currentStepStartedAt
            ? new Date(runningJob.currentStepStartedAt)
            : null,
        },
        now,
      )
    : null;

  // hasQueuedWaiting: only when more than one task is active. A single job
  // (whether RUNNING or PENDING) does not count — the strip's "más tareas
  // esperando" copy is meaningless when there's only one.
  const hasQueuedWaiting = running.length + pending.length > 1;

  const queuedJobTypes = Array.from(new Set(pending.map((j) => j.jobType)));

  return {
    hasAnyActive: true,
    runningJobType,
    runningJobPercent,
    hasQueuedWaiting,
    queuedJobTypes,
  };
}
