import { describe, it, expect } from "vitest";
import {
  aggregateImportProgress,
  filterJobsBySessionCutoff,
  pickSessionCutoff,
  type ApiJobLite,
} from "@/lib/onboarding/aggregate-progress";

function apiJob(overrides: Partial<ApiJobLite> = {}): ApiJobLite {
  return {
    id: "j1",
    jobType: "PULL_COMPROBANTES",
    status: "RUNNING",
    currentStep: "login",
    currentStepStartedAt: null,
    fiscalYear: 2026,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("aggregateImportProgress", () => {
  it("returns the empty-equivalent snapshot when no tracked jobs match", () => {
    const { snapshot, summary } = aggregateImportProgress(
      [apiJob({ jobType: "VALIDATE_CREDENTIALS", status: "RUNNING" })],
      2026,
    );
    expect(snapshot.allDone).toBe(true);
    expect(snapshot.trackedCount).toBe(0);
    expect(summary).toEqual({ invoices: 0, receipts: 0, presentaciones: 0 });
  });

  it("filters by fiscalYear", () => {
    const { snapshot } = aggregateImportProgress(
      [
        apiJob({ jobType: "PULL_COMPROBANTES", status: "RUNNING", fiscalYear: 2025 }),
        apiJob({ jobType: "PULL_COMPROBANTES", status: "RUNNING", fiscalYear: 2026 }),
      ],
      2026,
    );
    expect(snapshot.trackedCount).toBe(1);
  });

  it("uses the most recent job per type (first-seen since API orders desc)", () => {
    const { snapshot } = aggregateImportProgress(
      [
        // Latest first
        apiJob({
          id: "new",
          jobType: "PULL_COMPROBANTES",
          status: "RUNNING",
          currentStep: "classify",
        }),
        apiJob({
          id: "old",
          jobType: "PULL_COMPROBANTES",
          status: "COMPLETED",
          currentStep: "done",
        }),
      ],
      2026,
    );
    // Since "new" is RUNNING at classify, snapshot should reflect classifying stage.
    expect(snapshot.stage).toBe("classifying");
    expect(snapshot.allDone).toBe(false);
  });

  it("populates summary counts from completed jobs' resultData", () => {
    const { summary } = aggregateImportProgress(
      [
        apiJob({
          jobType: "PULL_COMPROBANTES",
          status: "COMPLETED",
          currentStep: "classify",
          resultData: { importedCount: 12 },
        }),
        apiJob({
          jobType: "PULL_DOMESTIC_RECEIPTS",
          status: "COMPLETED",
          currentStep: "done",
          resultData: { receiptsCount: 4 },
        }),
        apiJob({
          jobType: "PULL_PRESENTACIONES",
          status: "COMPLETED",
          currentStep: "done",
          resultData: { presentacionesCount: 2 },
        }),
      ],
      2026,
    );
    expect(summary).toEqual({ invoices: 12, receipts: 4, presentaciones: 2 });
  });

  it("leaves summary at 0 when jobs are still running", () => {
    const { summary } = aggregateImportProgress(
      [apiJob({ jobType: "PULL_COMPROBANTES", status: "RUNNING", currentStep: "download" })],
      2026,
    );
    expect(summary.invoices).toBe(0);
  });

  describe("completedTypes", () => {
    it("is empty when no tracked jobs are completed", () => {
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({ jobType: "PULL_COMPROBANTES", status: "RUNNING", currentStep: "download" }),
          apiJob({ jobType: "PULL_DOMESTIC_RECEIPTS", status: "PENDING", currentStep: null }),
        ],
        2026,
      );
      expect(snapshot.completedTypes).toEqual([]);
    });

    it("includes a single completed type", () => {
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "COMPLETED",
            currentStep: "classify",
            resultData: { importedCount: 5 },
          }),
          apiJob({ jobType: "PULL_DOMESTIC_RECEIPTS", status: "RUNNING", currentStep: "download" }),
        ],
        2026,
      );
      expect(snapshot.completedTypes).toEqual(["PULL_COMPROBANTES"]);
    });

    it("includes multiple completed types when several finish in the same poll cycle", () => {
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "COMPLETED",
            currentStep: "classify",
            resultData: { importedCount: 5 },
          }),
          apiJob({
            jobType: "PULL_DOMESTIC_RECEIPTS",
            status: "COMPLETED",
            currentStep: "save",
            resultData: { receiptsCount: 3 },
          }),
          apiJob({
            jobType: "PULL_PRESENTACIONES",
            status: "RUNNING",
            currentStep: "download",
          }),
        ],
        2026,
      );
      expect(snapshot.completedTypes).toEqual(
        expect.arrayContaining(["PULL_COMPROBANTES", "PULL_DOMESTIC_RECEIPTS"]),
      );
      expect(snapshot.completedTypes).toHaveLength(2);
    });
  });

  describe("percentByType", () => {
    it("exposes a per-type map alongside the global percent", () => {
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "COMPLETED",
            currentStep: "classify",
            resultData: { importedCount: 5 },
          }),
          apiJob({
            jobType: "PULL_DOMESTIC_RECEIPTS",
            status: "RUNNING",
            currentStep: "login",
          }),
        ],
        2026,
      );
      expect(snapshot.percentByType.PULL_COMPROBANTES).toBe(100);
      expect(snapshot.percentByType.PULL_DOMESTIC_RECEIPTS).toBeLessThan(50);
      expect(snapshot.percentByType.PULL_PRESENTACIONES).toBe(0);
      expect(snapshot.percentByType.PULL_PROFILE).toBe(0);
    });
  });

  describe("currentStepStartedAt", () => {
    it("parses ISO string timestamps into Date objects for the snapshot", () => {
      const startedAt = "2026-05-01T11:59:30Z"; // 30s ago vs the `now` below
      const now = new Date("2026-05-01T12:00:00Z").getTime();
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "RUNNING",
            currentStep: "download",
            currentStepStartedAt: startedAt,
          }),
        ],
        2026,
        now,
      );
      // download is 30s, capped at 90% in-flight = 27s. Before-step = 23s.
      // Total = 23 + 27 = 50 / 65 = ~77%.
      expect(snapshot.percent).toBeGreaterThanOrEqual(75);
      expect(snapshot.percent).toBeLessThanOrEqual(78);
    });

    it("treats missing currentStepStartedAt as no in-flight weight", () => {
      const now = new Date("2026-05-01T12:00:00Z").getTime();
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "RUNNING",
            currentStep: "download",
            currentStepStartedAt: null,
          }),
        ],
        2026,
        now,
      );
      // Just before-step (23s) / 65s = ~35%.
      expect(snapshot.percent).toBeGreaterThanOrEqual(33);
      expect(snapshot.percent).toBeLessThanOrEqual(38);
    });
  });

  describe("multi-job aggregation", () => {
    it("aggregates total weight across multiple running jobs (not arithmetic mean)", () => {
      const now = new Date("2026-05-01T12:00:00Z").getTime();
      const { snapshot } = aggregateImportProgress(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "COMPLETED",
            currentStep: "classify",
          }),
          apiJob({
            jobType: "PULL_DOMESTIC_RECEIPTS",
            status: "RUNNING",
            currentStep: "login",
            currentStepStartedAt: null,
          }),
        ],
        2026,
        now,
      );
      // PULL_COMPROBANTES total ~65s contributes 65 completed.
      // PULL_DOMESTIC_RECEIPTS total ~44s contributes 0 completed (at start of login).
      // Aggregate = 65 / (65 + 44) = ~60%.
      expect(snapshot.percent).toBeGreaterThanOrEqual(55);
      expect(snapshot.percent).toBeLessThanOrEqual(65);
    });
  });

  describe("pickSessionCutoff", () => {
    const T0 = new Date("2026-05-01T10:00:00Z").toISOString();
    const T1 = new Date("2026-05-01T11:00:00Z").toISOString();
    const T2 = new Date("2026-05-01T12:00:00Z").toISOString();

    it("returns null cutoff when there are no active tracked jobs", () => {
      const result = pickSessionCutoff(
        [apiJob({ status: "COMPLETED", createdAt: T0 })],
        2026,
        null,
        false,
      );
      expect(result.cutoff).toBeNull();
      expect(result.wasActive).toBe(false);
    });

    it("locks cutoff to earliest active createdAt on transition into active state", () => {
      const result = pickSessionCutoff(
        [
          apiJob({
            jobType: "PULL_COMPROBANTES",
            status: "COMPLETED",
            createdAt: T0,
          }),
          apiJob({
            jobType: "PULL_PROFILE",
            status: "RUNNING",
            createdAt: T2,
          }),
        ],
        2026,
        null,
        false,
      );
      // Earliest active is PULL_PROFILE at T2 — old completed PULL_COMPROBANTES is excluded.
      expect(result.cutoff).toBe(new Date(T2).getTime());
      expect(result.wasActive).toBe(true);
    });

    it("preserves cutoff while session is active (does not move forward when a job completes)", () => {
      const prevCutoff = new Date(T1).getTime();
      const result = pickSessionCutoff(
        [
          // The earlier active job just finished — only the later one is still active.
          apiJob({ id: "a", jobType: "PULL_COMPROBANTES", status: "COMPLETED", createdAt: T1 }),
          apiJob({ id: "b", jobType: "PULL_PROFILE", status: "RUNNING", createdAt: T2 }),
        ],
        2026,
        prevCutoff,
        true,
      );
      // Cutoff stays at T1 so the just-completed job still contributes to the bar.
      expect(result.cutoff).toBe(prevCutoff);
      expect(result.wasActive).toBe(true);
    });

    it("preserves cutoff after the session ends (post-completion success view)", () => {
      const prevCutoff = new Date(T1).getTime();
      const result = pickSessionCutoff(
        [apiJob({ status: "COMPLETED", createdAt: T1 })],
        2026,
        prevCutoff,
        true,
      );
      expect(result.cutoff).toBe(prevCutoff);
      expect(result.wasActive).toBe(false);
    });

    it("re-locks cutoff when entering a new active session after the previous one ended", () => {
      const prevCutoff = new Date(T1).getTime();
      // Previous session ended (wasActive false), new active job arrives.
      const result = pickSessionCutoff(
        [
          apiJob({ id: "old", status: "COMPLETED", createdAt: T1 }),
          apiJob({
            id: "new",
            jobType: "PULL_PROFILE",
            status: "RUNNING",
            createdAt: T2,
          }),
        ],
        2026,
        prevCutoff,
        false,
      );
      expect(result.cutoff).toBe(new Date(T2).getTime());
      expect(result.wasActive).toBe(true);
    });

    it("ignores jobs from other fiscal years when locking", () => {
      const result = pickSessionCutoff(
        [
          apiJob({
            jobType: "PULL_PROFILE",
            status: "RUNNING",
            createdAt: T0,
            fiscalYear: 2025,
          }),
          apiJob({
            jobType: "PULL_PROFILE",
            status: "RUNNING",
            createdAt: T2,
            fiscalYear: 2026,
          }),
        ],
        2026,
        null,
        false,
      );
      expect(result.cutoff).toBe(new Date(T2).getTime());
    });
  });

  describe("filterJobsBySessionCutoff", () => {
    const T0 = new Date("2026-05-01T10:00:00Z").toISOString();
    const T1 = new Date("2026-05-01T11:00:00Z").toISOString();
    const T2 = new Date("2026-05-01T12:00:00Z").toISOString();

    it("returns empty array when cutoff is null", () => {
      expect(filterJobsBySessionCutoff([apiJob({ createdAt: T1 })], null)).toEqual([]);
    });

    it("includes only jobs with createdAt >= cutoff", () => {
      const cutoff = new Date(T1).getTime();
      const old = apiJob({ id: "old", createdAt: T0 });
      const atCutoff = apiJob({ id: "atCutoff", createdAt: T1 });
      const newer = apiJob({ id: "newer", createdAt: T2 });
      const result = filterJobsBySessionCutoff([old, atCutoff, newer], cutoff);
      expect(result.map((j) => j.id)).toEqual(["atCutoff", "newer"]);
    });
  });

  it("handles missing or malformed resultData gracefully", () => {
    const { summary } = aggregateImportProgress(
      [
        apiJob({
          jobType: "PULL_COMPROBANTES",
          status: "COMPLETED",
          resultData: null,
        }),
        apiJob({
          jobType: "PULL_DOMESTIC_RECEIPTS",
          status: "COMPLETED",
          resultData: { unrelated: "field" },
        }),
      ],
      2026,
    );
    expect(summary.invoices).toBe(0);
    expect(summary.receipts).toBe(0);
  });
});
