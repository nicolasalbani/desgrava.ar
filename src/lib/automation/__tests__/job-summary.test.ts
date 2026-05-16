import { describe, it, expect } from "vitest";
import { jobSummarySelect, JOB_SUMMARY_REQUIRED_KEYS } from "@/lib/automation/job-summary";

describe("jobSummarySelect", () => {
  it("never includes the heavy `logs` field", () => {
    expect("logs" in jobSummarySelect).toBe(false);
  });

  it("never includes the heavy `screenshotUrl` field", () => {
    expect("screenshotUrl" in jobSummarySelect).toBe(false);
  });

  it("never includes the heavy `errorMessage` field (use /[jobId] route for that)", () => {
    expect("errorMessage" in jobSummarySelect).toBe(false);
  });

  it("includes the required identity + status fields", () => {
    expect(jobSummarySelect.id).toBe(true);
    expect(jobSummarySelect.jobType).toBe(true);
    expect(jobSummarySelect.status).toBe(true);
  });

  it("includes the fields the progress hook reads from each job", () => {
    expect(jobSummarySelect.currentStep).toBe(true);
    expect(jobSummarySelect.currentStepStartedAt).toBe(true);
    expect(jobSummarySelect.fiscalYear).toBe(true);
    expect(jobSummarySelect.createdAt).toBe(true);
  });

  it("includes the relation FK columns consumers depend on (familyDependentId, employerId)", () => {
    expect(jobSummarySelect.familyDependentId).toBe(true);
    expect(jobSummarySelect.employerId).toBe(true);
  });

  it("narrows the invoice subselect to the 6 fields the UI shows", () => {
    expect(jobSummarySelect.invoice).toEqual({
      select: {
        providerName: true,
        providerCuit: true,
        invoiceNumber: true,
        invoiceDate: true,
        amount: true,
        deductionCategory: true,
      },
    });
  });
});

describe("JOB_SUMMARY_REQUIRED_KEYS", () => {
  it("matches the keys actually selected", () => {
    for (const key of JOB_SUMMARY_REQUIRED_KEYS) {
      expect(key in jobSummarySelect).toBe(true);
    }
  });
});
