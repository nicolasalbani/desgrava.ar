/**
 * Collapse retries of the same underlying operation into a single "problem" entry
 * so Ganancio doesn't list every attempt back to the user.
 *
 * Grouping key: (jobType, invoiceId | presentacionId | employerId |
 *                familyDependentId | domesticWorkerId | "none", fiscalYear).
 */

export interface FailedJobRaw {
  id: string;
  jobType: string;
  errorMessage: string | null;
  currentStep: string | null;
  fiscalYear: number | null;
  createdAt: Date;
  invoiceId: string | null;
  presentacionId: string | null;
  employerId: string | null;
  familyDependentId: string | null;
  invoice: { providerName: string | null; providerCuit: string } | null;
  domesticReceipts: Array<{
    id: string;
    periodo: string;
    domesticWorker: { id: string; apellidoNombre: string } | null;
  }>;
  presentacion: { descripcion: string } | null;
  employer: { razonSocial: string } | null;
}

export interface FailedJobGroup {
  /** Most recent job in the group — used as the canonical id when creating a ticket. */
  jobId: string;
  type: string;
  typeLabel: string;
  relatedEntity: string | null;
  fiscalYear: number | null;
  attempts: number;
  latestError: string | null;
  /** Most recent step the latest attempt was stuck on, if known. */
  latestFailedAtStep: string | null;
  firstFailedAt: string;
  lastFailedAt: string;
  /** Up to N distinct prior error messages, latest-first, excluding `latestError`. */
  previousErrors: string[];
}

export interface GroupFailedJobsOptions {
  /** Max distinct prior error messages to include per group. Default 3. */
  maxPreviousErrors?: number;
  /** Max groups returned. Default 10. */
  maxGroups?: number;
  /** Job-type to human label map. */
  jobTypeLabels: Record<string, string>;
}

export function getGroupKey(job: FailedJobRaw): string {
  const domesticWorkerId = job.domesticReceipts[0]?.domesticWorker?.id ?? null;
  const subject =
    job.invoiceId ??
    job.presentacionId ??
    job.employerId ??
    job.familyDependentId ??
    domesticWorkerId ??
    "none";
  return `${job.jobType}::${subject}::${job.fiscalYear ?? "none"}`;
}

function buildRelatedEntity(job: FailedJobRaw): string | null {
  if (job.invoice) {
    return job.invoice.providerName || job.invoice.providerCuit;
  }
  if (job.domesticReceipts.length > 0) {
    const receipt = job.domesticReceipts[0];
    return receipt.domesticWorker
      ? `${receipt.domesticWorker.apellidoNombre} — ${receipt.periodo}`
      : receipt.periodo;
  }
  if (job.presentacion) return job.presentacion.descripcion;
  if (job.employer) return job.employer.razonSocial;
  return null;
}

export function groupFailedJobs(
  jobs: FailedJobRaw[],
  options: GroupFailedJobsOptions,
): FailedJobGroup[] {
  const maxPreviousErrors = options.maxPreviousErrors ?? 3;
  const maxGroups = options.maxGroups ?? 10;
  const labels = options.jobTypeLabels;

  // Sort newest-first so the first job we see for a group is the canonical "latest"
  const sorted = [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const groups = new Map<string, FailedJobGroup>();

  for (const job of sorted) {
    const key = getGroupKey(job);
    const existing = groups.get(key);
    const error = job.errorMessage;

    if (!existing) {
      groups.set(key, {
        jobId: job.id,
        type: job.jobType,
        typeLabel: labels[job.jobType] || job.jobType,
        relatedEntity: buildRelatedEntity(job),
        fiscalYear: job.fiscalYear,
        attempts: 1,
        latestError: error,
        latestFailedAtStep: job.currentStep,
        firstFailedAt: job.createdAt.toISOString(),
        lastFailedAt: job.createdAt.toISOString(),
        previousErrors: [],
      });
      continue;
    }

    existing.attempts += 1;
    // sorted is newest-first; later iterations are older attempts
    existing.firstFailedAt = job.createdAt.toISOString();
    if (
      error &&
      error !== existing.latestError &&
      !existing.previousErrors.includes(error) &&
      existing.previousErrors.length < maxPreviousErrors
    ) {
      existing.previousErrors.push(error);
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => new Date(b.lastFailedAt).getTime() - new Date(a.lastFailedAt).getTime())
    .slice(0, maxGroups);
}
