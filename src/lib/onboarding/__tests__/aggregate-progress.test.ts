import { describe, it, expect } from "vitest";
import { aggregateImportProgress, type ApiJobLite } from "@/lib/onboarding/aggregate-progress";

function apiJob(overrides: Partial<ApiJobLite> = {}): ApiJobLite {
  return {
    id: "j1",
    jobType: "PULL_COMPROBANTES",
    status: "RUNNING",
    currentStep: "login",
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
