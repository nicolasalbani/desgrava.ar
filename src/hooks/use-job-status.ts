"use client";

import { useEffect, useRef, useState } from "react";

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

const TERMINAL_STATUSES: ReadonlyArray<JobStatus> = ["COMPLETED", "FAILED", "CANCELLED"];

export function isTerminalStatus(status: string | null | undefined): boolean {
  return status != null && (TERMINAL_STATUSES as ReadonlyArray<string>).includes(status);
}

export interface JobStatusState {
  status: JobStatus | null;
  currentStep: string | null;
  errorMessage: string | null;
  resultData: unknown;
  isTerminal: boolean;
  /** True after the first successful fetch. */
  loaded: boolean;
}

const INITIAL_STATE: JobStatusState = {
  status: null,
  currentStep: null,
  errorMessage: null,
  resultData: null,
  isTerminal: false,
  loaded: false,
};

interface ApiJob {
  status?: string;
  currentStep?: string | null;
  errorMessage?: string | null;
  resultData?: unknown;
}

/**
 * Pure helper: turn the JSON body of `GET /api/automatizacion/[jobId]` into a
 * normalized poll state. Exported for unit tests.
 */
export function parseJobResponse(body: unknown): JobStatusState | null {
  if (!body || typeof body !== "object") return null;
  const job = (body as { job?: ApiJob }).job;
  if (!job || typeof job !== "object") return null;

  const status = (job.status ?? null) as JobStatus | null;
  return {
    status,
    currentStep: job.currentStep ?? null,
    errorMessage: job.errorMessage ?? null,
    resultData: job.resultData ?? null,
    isTerminal: isTerminalStatus(status),
    loaded: true,
  };
}

interface UseJobStatusOptions {
  /** Poll cadence in ms while job is non-terminal. Default 1500. */
  pollIntervalMs?: number;
  /** Called once when the job transitions into a terminal state. */
  onTerminal?: (state: JobStatusState) => void;
  /** Called if the underlying fetch fails (network/HTTP error). Polling continues. */
  onFetchError?: (error: unknown) => void;
}

/**
 * Polls `GET /api/automatizacion/[jobId]` until the job reaches a terminal
 * status. Replaces the deleted SSE log stream.
 *
 * Pass `null`/`undefined` as `jobId` to disable polling. When the job becomes
 * terminal, polling stops and `onTerminal` fires once with the final state.
 *
 * Network errors don't bail out — the next tick retries. Only an explicit
 * `FAILED` from the API surfaces as a job failure.
 */
export function useJobStatus(
  jobId: string | null | undefined,
  options: UseJobStatusOptions = {},
): JobStatusState {
  const { pollIntervalMs = 1500, onTerminal, onFetchError } = options;
  const [state, setState] = useState<JobStatusState>(INITIAL_STATE);

  // Latest callbacks via refs so the effect doesn't re-run when they change.
  const onTerminalRef = useRef(onTerminal);
  const onFetchErrorRef = useRef(onFetchError);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
    onFetchErrorRef.current = onFetchError;
  }, [onTerminal, onFetchError]);

  useEffect(() => {
    if (!jobId) {
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let firedTerminal = false;
    setState(INITIAL_STATE);

    async function tick() {
      try {
        const res = await fetch(`/api/automatizacion/${jobId}`);
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const body = await res.json();
        if (cancelled) return;

        const next = parseJobResponse(body);
        if (!next) {
          // Unexpected shape — keep polling, treat as transient.
          schedule();
          return;
        }

        setState(next);

        if (next.isTerminal) {
          if (!firedTerminal) {
            firedTerminal = true;
            onTerminalRef.current?.(next);
          }
          return;
        }
      } catch (err) {
        if (cancelled) return;
        onFetchErrorRef.current?.(err);
      }
      schedule();
    }

    function schedule() {
      timeoutId = setTimeout(tick, pollIntervalMs);
    }

    // Fire the first poll immediately so consumers see state on mount.
    tick();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [jobId, pollIntervalMs]);

  return state;
}
