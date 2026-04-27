import { describe, it, expect } from "vitest";
import { computeProgressSnapshot, type JobLite } from "@/lib/onboarding/progress-stages";

function job(
  jobType: string,
  status: JobLite["status"],
  currentStep: string | null = null,
): JobLite {
  return { jobType, status, currentStep };
}

describe("computeProgressSnapshot", () => {
  it("returns done with 0% when no tracked jobs exist", () => {
    const snap = computeProgressSnapshot([]);
    expect(snap.allDone).toBe(true);
    expect(snap.stage).toBe("done");
    expect(snap.percent).toBe(0);
    expect(snap.trackedCount).toBe(0);
  });

  it("ignores untracked job types", () => {
    const snap = computeProgressSnapshot([job("VALIDATE_CREDENTIALS", "RUNNING", "verify")]);
    expect(snap.trackedCount).toBe(0);
    expect(snap.allDone).toBe(true);
  });

  it("reports connecting stage for a single PULL_COMPROBANTES at login", () => {
    const snap = computeProgressSnapshot([job("PULL_COMPROBANTES", "RUNNING", "login")]);
    expect(snap.stage).toBe("connecting");
    expect(snap.allDone).toBe(false);
    expect(snap.hasRunning).toBe(true);
  });

  it("reports invoices stage when PULL_COMPROBANTES is downloading", () => {
    const snap = computeProgressSnapshot([job("PULL_COMPROBANTES", "RUNNING", "download")]);
    expect(snap.stage).toBe("invoices");
  });

  it("reports classifying stage when PULL_COMPROBANTES reaches classify", () => {
    const snap = computeProgressSnapshot([job("PULL_COMPROBANTES", "RUNNING", "classify")]);
    expect(snap.stage).toBe("classifying");
  });

  it("reports receipts stage for a running PULL_DOMESTIC_RECEIPTS download", () => {
    const snap = computeProgressSnapshot([job("PULL_DOMESTIC_RECEIPTS", "RUNNING", "download")]);
    expect(snap.stage).toBe("receipts");
  });

  it("reports employers stage for leftover PULL_PROFILE.empleadores", () => {
    const snap = computeProgressSnapshot([job("PULL_PROFILE", "RUNNING", "empleadores")]);
    expect(snap.stage).toBe("employers");
  });

  it("reports dependents stage for leftover PULL_PROFILE.cargas_familia", () => {
    const snap = computeProgressSnapshot([job("PULL_PROFILE", "RUNNING", "cargas_familia")]);
    expect(snap.stage).toBe("dependents");
  });

  it("picks the highest stage among multiple concurrent jobs", () => {
    // PULL_COMPROBANTES is at classify (later); PULL_DOMESTIC_RECEIPTS is at login (earlier).
    const snap = computeProgressSnapshot([
      job("PULL_COMPROBANTES", "RUNNING", "classify"),
      job("PULL_DOMESTIC_RECEIPTS", "RUNNING", "login"),
    ]);
    expect(snap.stage).toBe("classifying");
  });

  it("returns allDone when every tracked job is COMPLETED", () => {
    const snap = computeProgressSnapshot([
      job("PULL_COMPROBANTES", "COMPLETED", "classify"),
      job("PULL_DOMESTIC_RECEIPTS", "COMPLETED", "done"),
      job("PULL_PRESENTACIONES", "COMPLETED", "done"),
    ]);
    expect(snap.allDone).toBe(true);
    expect(snap.stage).toBe("done");
    expect(snap.percent).toBe(100);
    expect(snap.hasFailed).toBe(false);
  });

  it("flags hasFailed when any tracked job is FAILED but still aggregates progress", () => {
    const snap = computeProgressSnapshot([
      job("PULL_COMPROBANTES", "COMPLETED", "classify"),
      job("PULL_DOMESTIC_RECEIPTS", "FAILED", "siradig"),
      job("PULL_PRESENTACIONES", "RUNNING", "download"),
    ]);
    expect(snap.hasFailed).toBe(true);
    expect(snap.allDone).toBe(false);
    expect(snap.percent).toBeGreaterThan(0);
    expect(snap.percent).toBeLessThan(100);
  });

  it("computes a percentage between 0 and 100 mid-flight", () => {
    const snap = computeProgressSnapshot([job("PULL_COMPROBANTES", "RUNNING", "siradig_extract")]);
    expect(snap.percent).toBeGreaterThan(0);
    expect(snap.percent).toBeLessThan(100);
  });

  it("treats hasFailed=true as not allDone even if all jobs are terminal", () => {
    const snap = computeProgressSnapshot([
      job("PULL_COMPROBANTES", "FAILED", "siradig"),
      job("PULL_DOMESTIC_RECEIPTS", "COMPLETED", "done"),
      job("PULL_PRESENTACIONES", "COMPLETED", "done"),
    ]);
    expect(snap.hasFailed).toBe(true);
    expect(snap.allDone).toBe(false);
  });
});
