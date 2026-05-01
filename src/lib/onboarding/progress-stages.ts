import { JOB_TYPE_STEPS, JOB_STEP_DURATIONS } from "@/lib/automation/job-steps";

export type Stage =
  | "connecting"
  | "invoices"
  | "employers"
  | "dependents"
  | "receipts"
  | "presentaciones"
  | "classifying"
  | "done";

export const STAGE_LABELS: Record<Stage, string> = {
  connecting: "Conectando con ARCA",
  invoices: "Trayendo tus comprobantes",
  employers: "Trayendo empleadores",
  dependents: "Trayendo cargas de familia",
  receipts: "Trayendo recibos salariales",
  presentaciones: "Trayendo presentaciones",
  classifying: "Clasificando proveedores",
  done: "Listo",
};

export const TRACKED_JOB_TYPES = [
  "PULL_COMPROBANTES",
  "PULL_DOMESTIC_RECEIPTS",
  "PULL_PRESENTACIONES",
  "PULL_PROFILE",
] as const;

export type TrackedJobType = (typeof TRACKED_JOB_TYPES)[number];

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface JobLite {
  jobType: string;
  status: JobStatus;
  currentStep: string | null;
  /** Wall-clock time when `currentStep` was last set. Used to compute in-flight
   *  partial-step weight so the bar gradually moves between step transitions. */
  currentStepStartedAt?: Date | null;
}

interface StepMapping {
  jobType: TrackedJobType;
  stepKey: string;
  stage: Stage;
}

// Map underlying job step → high-level stage (only steps that contribute to a visible stage).
const STEP_TO_STAGE: StepMapping[] = [
  { jobType: "PULL_COMPROBANTES", stepKey: "login", stage: "connecting" },
  { jobType: "PULL_COMPROBANTES", stepKey: "siradig", stage: "connecting" },
  { jobType: "PULL_COMPROBANTES", stepKey: "siradig_extract", stage: "invoices" },
  { jobType: "PULL_COMPROBANTES", stepKey: "navigate_comprobantes", stage: "invoices" },
  { jobType: "PULL_COMPROBANTES", stepKey: "download", stage: "invoices" },
  { jobType: "PULL_COMPROBANTES", stepKey: "classify", stage: "classifying" },
  { jobType: "PULL_DOMESTIC_RECEIPTS", stepKey: "login", stage: "connecting" },
  { jobType: "PULL_DOMESTIC_RECEIPTS", stepKey: "siradig", stage: "connecting" },
  { jobType: "PULL_DOMESTIC_RECEIPTS", stepKey: "siradig_extract", stage: "receipts" },
  { jobType: "PULL_DOMESTIC_RECEIPTS", stepKey: "download", stage: "receipts" },
  { jobType: "PULL_DOMESTIC_RECEIPTS", stepKey: "save", stage: "receipts" },
  { jobType: "PULL_PRESENTACIONES", stepKey: "login", stage: "connecting" },
  { jobType: "PULL_PRESENTACIONES", stepKey: "siradig", stage: "connecting" },
  { jobType: "PULL_PRESENTACIONES", stepKey: "download", stage: "presentaciones" },
  { jobType: "PULL_PROFILE", stepKey: "login", stage: "connecting" },
  { jobType: "PULL_PROFILE", stepKey: "siradig", stage: "connecting" },
  { jobType: "PULL_PROFILE", stepKey: "datos_personales", stage: "employers" },
  { jobType: "PULL_PROFILE", stepKey: "empleadores", stage: "employers" },
  { jobType: "PULL_PROFILE", stepKey: "cargas_familia", stage: "dependents" },
  { jobType: "PULL_PROFILE", stepKey: "casas_particulares", stage: "dependents" },
];

export interface ProgressSnapshot {
  stage: Stage;
  stageLabel: string;
  /** Aggregate percent across all tracked jobs, time-weighted. */
  percent: number;
  /** Per-tracked-type percent so individual import buttons can show their own
   *  fill. Types not present in the job list default to 0. */
  percentByType: Record<TrackedJobType, number>;
  hasFailed: boolean;
  hasRunning: boolean;
  allDone: boolean;
  trackedCount: number;
  /** Tracked job types currently in COMPLETED status. Consumers diff this
   *  across renders to detect transitions and trigger side effects (e.g.,
   *  refreshing a list when the relevant import finishes). */
  completedTypes: ReadonlyArray<TrackedJobType>;
  /** Tracked job types currently in PENDING or RUNNING status. Consumers use
   *  this to scope UI state (e.g., the import button) to its own job type
   *  when multiple imports run concurrently. */
  runningTypes: ReadonlyArray<TrackedJobType>;
}

const STAGE_ORDER: Stage[] = [
  "connecting",
  "employers",
  "dependents",
  "invoices",
  "receipts",
  "presentaciones",
  "classifying",
  "done",
];

const IN_FLIGHT_CAP = 0.9;

const EMPTY_PERCENT_BY_TYPE: Record<TrackedJobType, number> = {
  PULL_COMPROBANTES: 0,
  PULL_DOMESTIC_RECEIPTS: 0,
  PULL_PRESENTACIONES: 0,
  PULL_PROFILE: 0,
};

function isTracked(jobType: string): jobType is TrackedJobType {
  return (TRACKED_JOB_TYPES as readonly string[]).includes(jobType);
}

function stageForJobAndStep(jobType: TrackedJobType, stepKey: string | null): Stage | null {
  if (!stepKey) return null;
  const match = STEP_TO_STAGE.find((m) => m.jobType === jobType && m.stepKey === stepKey);
  return match?.stage ?? null;
}

function highestStage(stages: Stage[]): Stage | null {
  if (stages.length === 0) return null;
  let max: Stage = stages[0];
  let maxIdx = STAGE_ORDER.indexOf(max);
  for (const s of stages) {
    const idx = STAGE_ORDER.indexOf(s);
    if (idx > maxIdx) {
      maxIdx = idx;
      max = s;
    }
  }
  return max;
}

/** Sum of all step durations for a job type (its expected total wall-clock time). */
function totalDurationFor(jobType: TrackedJobType): number {
  const durations = JOB_STEP_DURATIONS[jobType] ?? {};
  const steps = JOB_TYPE_STEPS[jobType] ?? [];
  return steps.reduce((sum, s) => sum + (durations[s.key] ?? 0), 0);
}

/** Weight (seconds) covered by all steps that strictly precede `stepKey`. */
function weightBeforeStep(jobType: TrackedJobType, stepKey: string | null): number {
  const durations = JOB_STEP_DURATIONS[jobType] ?? {};
  const steps = JOB_TYPE_STEPS[jobType] ?? [];
  if (!stepKey) return 0;
  let sum = 0;
  for (const s of steps) {
    if (s.key === stepKey) break;
    sum += durations[s.key] ?? 0;
  }
  return sum;
}

function durationForStep(jobType: TrackedJobType, stepKey: string | null): number {
  if (!stepKey) return 0;
  return JOB_STEP_DURATIONS[jobType]?.[stepKey] ?? 0;
}

/** Per-job time-weighted progress (seconds). Returns `{ completed, total }`. */
function jobWeight(job: JobLite, now: number): { completed: number; total: number } {
  if (!isTracked(job.jobType)) return { completed: 0, total: 0 };
  const total = totalDurationFor(job.jobType);
  if (total === 0) return { completed: 0, total: 0 };

  if (job.status === "COMPLETED") {
    return { completed: total, total };
  }

  if (job.status === "FAILED" || job.status === "CANCELLED") {
    // Failed/cancelled freeze at the boundary of the failed step.
    return { completed: weightBeforeStep(job.jobType, job.currentStep), total };
  }

  // PENDING / RUNNING — count finished steps + a partial slice of the current
  // step proportional to elapsed wall-clock time.
  const before = weightBeforeStep(job.jobType, job.currentStep);
  const stepDuration = durationForStep(job.jobType, job.currentStep);
  let inFlight = 0;
  if (stepDuration > 0 && job.currentStepStartedAt) {
    const elapsedSec = Math.max(0, (now - job.currentStepStartedAt.getTime()) / 1000);
    inFlight = Math.min(stepDuration * IN_FLIGHT_CAP, elapsedSec);
  }
  return { completed: before + inFlight, total };
}

/**
 * Aggregate a list of automation jobs into a single high-level progress snapshot.
 * Only tracked job types contribute (PULL_COMPROBANTES, PULL_DOMESTIC_RECEIPTS,
 * PULL_PRESENTACIONES, leftover PULL_PROFILE).
 *
 * Percent is computed as `Σ completed weight / Σ total weight` across tracked
 * jobs, where weights come from `JOB_STEP_DURATIONS` (seconds per step). This
 * keeps the bar moving believably while a long step is in flight, instead of
 * jumping in big chunks at step transitions.
 */
export function computeProgressSnapshot(
  jobs: JobLite[],
  now: number = Date.now(),
): ProgressSnapshot {
  const tracked = jobs.filter((j) => isTracked(j.jobType));

  if (tracked.length === 0) {
    return {
      stage: "done",
      stageLabel: STAGE_LABELS.done,
      percent: 0,
      percentByType: { ...EMPTY_PERCENT_BY_TYPE },
      hasFailed: false,
      hasRunning: false,
      allDone: true,
      trackedCount: 0,
      completedTypes: [],
      runningTypes: [],
    };
  }

  let totalWeight = 0;
  let completedWeight = 0;
  const runningStages: Stage[] = [];
  const completedTypes: TrackedJobType[] = [];
  const runningTypes: TrackedJobType[] = [];
  const percentByType: Record<TrackedJobType, number> = { ...EMPTY_PERCENT_BY_TYPE };
  let hasFailed = false;
  let hasRunning = false;
  let allTerminal = true;

  for (const job of tracked) {
    if (!isTracked(job.jobType)) continue;
    const { completed, total } = jobWeight(job, now);
    if (total === 0) continue;
    totalWeight += total;
    completedWeight += completed;
    percentByType[job.jobType] = Math.min(100, Math.round((completed / total) * 100));

    if (job.status === "COMPLETED") {
      completedTypes.push(job.jobType);
    } else if (job.status === "FAILED" || job.status === "CANCELLED") {
      hasFailed = hasFailed || job.status === "FAILED";
    } else {
      // PENDING / RUNNING
      allTerminal = false;
      if (job.status === "RUNNING") hasRunning = true;
      runningTypes.push(job.jobType);
      const stage = stageForJobAndStep(job.jobType, job.currentStep);
      if (stage) runningStages.push(stage);
    }
  }

  const percent =
    totalWeight > 0 ? Math.min(100, Math.round((completedWeight / totalWeight) * 100)) : 0;
  const allDone = allTerminal && !hasFailed;
  const stage: Stage = allDone ? "done" : (highestStage(runningStages) ?? "connecting");

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    percent: allDone ? 100 : percent,
    percentByType,
    hasFailed,
    hasRunning,
    allDone,
    trackedCount: tracked.length,
    completedTypes,
    runningTypes,
  };
}
