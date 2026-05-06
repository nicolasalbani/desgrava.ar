/**
 * Stuck-job detection.
 *
 * A job is considered stuck if it's still in `RUNNING` status but its
 * `currentStepStartedAt` (or, as fallback, `startedAt`) hasn't advanced for
 * longer than the threshold. This protects us from orphaned rows when a
 * worker dies hard mid-job and the lock TTL expires without the job ever
 * moving to a terminal state.
 *
 * The Vercel `sweep-stuck-jobs` cron calls `findStuckJobs` (or builds the
 * equivalent Prisma `where`) and marks each match `FAILED`.
 */

export const STUCK_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

export interface StuckJobLite {
  status: string;
  startedAt: Date | null;
  currentStepStartedAt: Date | null;
}

/**
 * Pure helper: is this job stuck given the current wall clock and threshold?
 */
export function isJobStuck(
  job: StuckJobLite,
  now: Date,
  thresholdMs: number = STUCK_THRESHOLD_MS,
): boolean {
  if (job.status !== "RUNNING") return false;
  // Prefer `currentStepStartedAt` (advances per step). Fall back to `startedAt`
  // if the job was queued but never recorded a step (e.g. crashed in setup).
  const reference = job.currentStepStartedAt ?? job.startedAt;
  if (!reference) return false;
  return now.getTime() - reference.getTime() > thresholdMs;
}

/**
 * Given a wall clock and threshold, returns the cutoff `Date` such that any
 * RUNNING job with progress (currentStepStartedAt or startedAt) older than
 * the cutoff is stuck. The Prisma query in the route uses this.
 */
export function stuckCutoff(now: Date, thresholdMs: number = STUCK_THRESHOLD_MS): Date {
  return new Date(now.getTime() - thresholdMs);
}
