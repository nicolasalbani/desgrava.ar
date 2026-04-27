import { JOB_TYPE_STEPS } from "@/lib/automation/job-steps";

export type Stage =
  | "connecting"
  | "invoices"
  | "employers"
  | "dependents"
  | "receipts"
  | "classifying"
  | "done";

export const STAGE_LABELS: Record<Stage, string> = {
  connecting: "Conectando con ARCA",
  invoices: "Trayendo tus comprobantes",
  employers: "Trayendo empleadores",
  dependents: "Trayendo cargas de familia",
  receipts: "Trayendo recibos salariales",
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
  { jobType: "PULL_PRESENTACIONES", stepKey: "download", stage: "receipts" },
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
  percent: number;
  hasFailed: boolean;
  hasRunning: boolean;
  allDone: boolean;
  trackedCount: number;
}

const STAGE_ORDER: Stage[] = [
  "connecting",
  "employers",
  "dependents",
  "invoices",
  "receipts",
  "classifying",
  "done",
];

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

/**
 * Aggregate a list of automation jobs into a single high-level progress snapshot.
 * Only tracked job types contribute (PULL_COMPROBANTES, PULL_DOMESTIC_RECEIPTS,
 * PULL_PRESENTACIONES, leftover PULL_PROFILE).
 *
 * The percent is computed as: Σ completed step indexes / Σ total steps across tracked jobs.
 * The visible stage is the highest in-flight stage among RUNNING jobs (or "done" if all terminal).
 */
export function computeProgressSnapshot(jobs: JobLite[]): ProgressSnapshot {
  const tracked = jobs.filter((j) => isTracked(j.jobType));

  if (tracked.length === 0) {
    return {
      stage: "done",
      stageLabel: STAGE_LABELS.done,
      percent: 0,
      hasFailed: false,
      hasRunning: false,
      allDone: true,
      trackedCount: 0,
    };
  }

  let totalSteps = 0;
  let completedSteps = 0;
  const runningStages: Stage[] = [];
  let hasFailed = false;
  let hasRunning = false;
  let allTerminal = true;

  for (const job of tracked) {
    if (!isTracked(job.jobType)) continue;
    const steps = JOB_TYPE_STEPS[job.jobType] ?? [];
    if (steps.length === 0) continue;
    totalSteps += steps.length;

    if (job.status === "COMPLETED") {
      completedSteps += steps.length;
    } else if (job.status === "FAILED" || job.status === "CANCELLED") {
      hasFailed = hasFailed || job.status === "FAILED";
      // Failed/cancelled jobs count their progress up to currentStep.
      const idx = steps.findIndex((s) => s.key === job.currentStep);
      completedSteps += idx >= 0 ? idx + 1 : 0;
    } else {
      // PENDING / RUNNING
      allTerminal = false;
      if (job.status === "RUNNING") hasRunning = true;
      const idx = steps.findIndex((s) => s.key === job.currentStep);
      completedSteps += idx >= 0 ? idx : 0;
      const stage = stageForJobAndStep(job.jobType, job.currentStep);
      if (stage) runningStages.push(stage);
    }
  }

  const percent =
    totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;
  const allDone = allTerminal && !hasFailed;
  const stage: Stage = allDone ? "done" : (highestStage(runningStages) ?? "connecting");

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    percent: allDone ? 100 : percent,
    hasFailed,
    hasRunning,
    allDone,
    trackedCount: tracked.length,
  };
}
