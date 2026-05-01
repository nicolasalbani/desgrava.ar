import {
  computeProgressSnapshot,
  TRACKED_JOB_TYPES,
  type JobLite,
  type ProgressSnapshot,
} from "@/lib/onboarding/progress-stages";

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
