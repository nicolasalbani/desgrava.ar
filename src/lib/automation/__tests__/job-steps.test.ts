import { describe, it, expect } from "vitest";
import { JOB_TYPE_STEPS, getStepsForJobType } from "@/lib/automation/job-steps";

const ALL_JOB_TYPES = [
  "VALIDATE_CREDENTIALS",
  "SUBMIT_INVOICE",
  "BULK_SUBMIT",
  "PULL_FAMILY_DEPENDENTS",
  "PUSH_FAMILY_DEPENDENTS",
  "PULL_COMPROBANTES",
  "PULL_DOMESTIC_WORKERS",
  "PULL_DOMESTIC_RECEIPTS",
  "SUBMIT_DOMESTIC_DEDUCTION",
  "PULL_PRESENTACIONES",
  "SUBMIT_PRESENTACION",
  "PULL_EMPLOYERS",
  "PUSH_EMPLOYERS",
  "PULL_PERSONAL_DATA",
  "PULL_PROFILE",
];

describe("JOB_TYPE_STEPS", () => {
  it("has step definitions for every JobType", () => {
    for (const jobType of ALL_JOB_TYPES) {
      expect(JOB_TYPE_STEPS[jobType], `Missing steps for ${jobType}`).toBeDefined();
      expect(JOB_TYPE_STEPS[jobType].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every step list starts with 'login'", () => {
    for (const [jobType, steps] of Object.entries(JOB_TYPE_STEPS)) {
      expect(steps[0].key, `${jobType} should start with 'login'`).toBe("login");
    }
  });

  it("every step has a non-empty key and label", () => {
    for (const [jobType, steps] of Object.entries(JOB_TYPE_STEPS)) {
      for (const step of steps) {
        expect(step.key, `Empty key in ${jobType}`).toBeTruthy();
        expect(step.label, `Empty label in ${jobType}`).toBeTruthy();
      }
    }
  });

  it("has no duplicate step keys within a job type", () => {
    for (const [jobType, steps] of Object.entries(JOB_TYPE_STEPS)) {
      const keys = steps.map((s) => s.key);
      expect(new Set(keys).size, `Duplicate keys in ${jobType}`).toBe(keys.length);
    }
  });
});

describe("getStepsForJobType", () => {
  it("returns steps for known job types", () => {
    const steps = getStepsForJobType("PULL_COMPROBANTES");
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0].key).toBe("login");
  });

  it("returns empty array for unknown job types", () => {
    expect(getStepsForJobType("UNKNOWN_TYPE")).toEqual([]);
    expect(getStepsForJobType("")).toEqual([]);
  });
});
