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
  hasFailed: false,
  hasRunning: false,
  allDone: true,
  trackedCount: 0,
};

export const EMPTY_SUMMARY: ArcaImportSummary = {
  invoices: 0,
  receipts: 0,
  presentaciones: 0,
};

const TRACKED_SET = new Set<string>(TRACKED_JOB_TYPES);

/**
 * Pure aggregator: filters the /api/automatizacion job list to tracked types
 * for the given fiscal year, picks the latest job per type, and returns
 * the high-level progress snapshot plus the import summary counts.
 */
export function aggregateImportProgress(
  jobs: ApiJobLite[],
  fiscalYear: number,
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
  }));

  const snapshot = computeProgressSnapshot(lite);

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
