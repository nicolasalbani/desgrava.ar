import { describe, it, expect } from "vitest";
import { computePollInterval, ACTIVE_POLL_MS, IDLE_POLL_MS } from "@/hooks/poll-interval";

describe("computePollInterval", () => {
  it("returns the idle cadence when nothing is active", () => {
    expect(
      computePollInterval({
        hasRunning: false,
        hasPending: false,
        hasAnyActive: false,
        hasOptimistic: false,
      }),
    ).toBe(IDLE_POLL_MS);
  });

  it("returns the active cadence when a tracked import is running", () => {
    expect(
      computePollInterval({
        hasRunning: true,
        hasPending: false,
        hasAnyActive: false,
        hasOptimistic: false,
      }),
    ).toBe(ACTIVE_POLL_MS);
  });

  it("returns the active cadence when a job is pending", () => {
    expect(
      computePollInterval({
        hasRunning: false,
        hasPending: true,
        hasAnyActive: false,
        hasOptimistic: false,
      }),
    ).toBe(ACTIVE_POLL_MS);
  });

  it("returns the active cadence when a non-tracked automation is in flight", () => {
    expect(
      computePollInterval({
        hasRunning: false,
        hasPending: false,
        hasAnyActive: true,
        hasOptimistic: false,
      }),
    ).toBe(ACTIVE_POLL_MS);
  });

  it("returns the active cadence on optimistic enqueue before the API response", () => {
    expect(
      computePollInterval({
        hasRunning: false,
        hasPending: false,
        hasAnyActive: false,
        hasOptimistic: true,
      }),
    ).toBe(ACTIVE_POLL_MS);
  });

  it("idle cadence is meaningfully slower than active to amortize cache misses", () => {
    expect(IDLE_POLL_MS).toBeGreaterThanOrEqual(ACTIVE_POLL_MS * 5);
  });
});
