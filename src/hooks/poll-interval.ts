/**
 * Polling-cadence state machine for `useArcaImportProgress`.
 *
 * The polled endpoint (`GET /api/automatizacion`) has two distinct modes:
 *
 * - **Active**: at least one automation job is PENDING or RUNNING. The UI
 *   needs near-realtime feedback (progress bar, step transitions, "queued"
 *   banner), so we poll every 4s.
 *
 * - **Idle**: nothing is in flight. The poll only matters for catching jobs
 *   created in another tab/session or by a backend cron. 30s is plenty —
 *   most users don't have either of those signals fire while sitting idle.
 *
 * Keeping the hook polling every 4s while idle was costing 15 needless
 * Postgres reads per minute per dashboard user, and the response was
 * always identical: `{ jobs: [] }` or last-week's COMPLETED rows.
 */

export const ACTIVE_POLL_MS = 4000;
export const IDLE_POLL_MS = 30000;

export interface PollIntervalInput {
  /** Any tracked import (PULL_*) is in flight. */
  hasRunning: boolean;
  /** Any pending job is queued behind something else. */
  hasPending: boolean;
  /** Any non-tracked job (SUBMIT_*, PUSH_*, VALIDATE_*) is active. */
  hasAnyActive: boolean;
  /** A click just enqueued a job but the server response hasn't landed. */
  hasOptimistic: boolean;
}

/** Pure: pick the next poll delay from current state. */
export function computePollInterval(input: PollIntervalInput): number {
  if (input.hasRunning || input.hasPending || input.hasAnyActive || input.hasOptimistic) {
    return ACTIVE_POLL_MS;
  }
  return IDLE_POLL_MS;
}
