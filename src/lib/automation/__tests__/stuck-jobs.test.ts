import { describe, it, expect } from "vitest";
import {
  STUCK_THRESHOLD_MS,
  isJobStuck,
  stuckCutoff,
  type StuckJobLite,
} from "@/lib/automation/stuck-jobs";

const NOW = new Date("2026-05-05T12:00:00Z");
const THIRTY_MIN_AGO = new Date(NOW.getTime() - 30 * 60 * 1000);
const FIVE_MIN_AGO = new Date(NOW.getTime() - 5 * 60 * 1000);

describe("isJobStuck", () => {
  it("flags a RUNNING job whose currentStepStartedAt is older than threshold", () => {
    const job: StuckJobLite = {
      status: "RUNNING",
      startedAt: THIRTY_MIN_AGO,
      currentStepStartedAt: THIRTY_MIN_AGO,
    };
    expect(isJobStuck(job, NOW)).toBe(true);
  });

  it("does not flag a RUNNING job that just advanced a step", () => {
    const job: StuckJobLite = {
      status: "RUNNING",
      startedAt: THIRTY_MIN_AGO,
      currentStepStartedAt: FIVE_MIN_AGO,
    };
    expect(isJobStuck(job, NOW)).toBe(false);
  });

  it("falls back to startedAt when currentStepStartedAt is null", () => {
    const stuck: StuckJobLite = {
      status: "RUNNING",
      startedAt: THIRTY_MIN_AGO,
      currentStepStartedAt: null,
    };
    const fresh: StuckJobLite = {
      status: "RUNNING",
      startedAt: FIVE_MIN_AGO,
      currentStepStartedAt: null,
    };
    expect(isJobStuck(stuck, NOW)).toBe(true);
    expect(isJobStuck(fresh, NOW)).toBe(false);
  });

  it("does not flag terminal-status jobs", () => {
    const base: Omit<StuckJobLite, "status"> = {
      startedAt: THIRTY_MIN_AGO,
      currentStepStartedAt: THIRTY_MIN_AGO,
    };
    expect(isJobStuck({ ...base, status: "COMPLETED" }, NOW)).toBe(false);
    expect(isJobStuck({ ...base, status: "FAILED" }, NOW)).toBe(false);
    expect(isJobStuck({ ...base, status: "CANCELLED" }, NOW)).toBe(false);
    expect(isJobStuck({ ...base, status: "PENDING" }, NOW)).toBe(false);
  });

  it("does not flag a RUNNING job with no timestamps at all", () => {
    const job: StuckJobLite = {
      status: "RUNNING",
      startedAt: null,
      currentStepStartedAt: null,
    };
    expect(isJobStuck(job, NOW)).toBe(false);
  });

  it("respects a custom threshold", () => {
    const job: StuckJobLite = {
      status: "RUNNING",
      startedAt: NOW,
      currentStepStartedAt: FIVE_MIN_AGO, // 5 min old
    };
    // 10 min threshold: not stuck. 1 min threshold: stuck.
    expect(isJobStuck(job, NOW, 10 * 60 * 1000)).toBe(false);
    expect(isJobStuck(job, NOW, 1 * 60 * 1000)).toBe(true);
  });

  it("does not flag a job exactly at the threshold (strict greater-than)", () => {
    const exact = new Date(NOW.getTime() - STUCK_THRESHOLD_MS);
    const job: StuckJobLite = {
      status: "RUNNING",
      startedAt: exact,
      currentStepStartedAt: exact,
    };
    expect(isJobStuck(job, NOW)).toBe(false);
  });
});

describe("stuckCutoff", () => {
  it("returns now minus threshold", () => {
    expect(stuckCutoff(NOW).getTime()).toBe(NOW.getTime() - STUCK_THRESHOLD_MS);
  });

  it("respects a custom threshold", () => {
    const oneMin = 60 * 1000;
    expect(stuckCutoff(NOW, oneMin).getTime()).toBe(NOW.getTime() - oneMin);
  });
});

describe("STUCK_THRESHOLD_MS", () => {
  it("is 20 minutes", () => {
    expect(STUCK_THRESHOLD_MS).toBe(20 * 60 * 1000);
  });
});
