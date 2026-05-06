import { describe, it, expect } from "vitest";
import { isTerminalStatus, parseJobResponse } from "@/hooks/use-job-status";

describe("isTerminalStatus", () => {
  it("returns true for COMPLETED, FAILED, CANCELLED", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });

  it("returns false for non-terminal statuses", () => {
    expect(isTerminalStatus("PENDING")).toBe(false);
    expect(isTerminalStatus("RUNNING")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isTerminalStatus(null)).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
    expect(isTerminalStatus("")).toBe(false);
  });
});

describe("parseJobResponse", () => {
  it("extracts a normalized state from a well-formed body", () => {
    const state = parseJobResponse({
      job: {
        status: "RUNNING",
        currentStep: "login",
        errorMessage: null,
        resultData: { foo: 1 },
      },
    });
    expect(state).toEqual({
      status: "RUNNING",
      currentStep: "login",
      errorMessage: null,
      resultData: { foo: 1 },
      isTerminal: false,
      loaded: true,
    });
  });

  it("marks COMPLETED jobs as terminal", () => {
    const state = parseJobResponse({ job: { status: "COMPLETED", currentStep: "done" } });
    expect(state?.isTerminal).toBe(true);
    expect(state?.status).toBe("COMPLETED");
  });

  it("marks FAILED jobs as terminal and surfaces errorMessage", () => {
    const state = parseJobResponse({
      job: { status: "FAILED", errorMessage: "Timeout en SiRADIG" },
    });
    expect(state?.isTerminal).toBe(true);
    expect(state?.errorMessage).toBe("Timeout en SiRADIG");
  });

  it("marks CANCELLED jobs as terminal", () => {
    const state = parseJobResponse({ job: { status: "CANCELLED" } });
    expect(state?.isTerminal).toBe(true);
  });

  it("defaults missing fields to null", () => {
    const state = parseJobResponse({ job: { status: "PENDING" } });
    expect(state).toEqual({
      status: "PENDING",
      currentStep: null,
      errorMessage: null,
      resultData: null,
      isTerminal: false,
      loaded: true,
    });
  });

  it("returns null for non-object bodies", () => {
    expect(parseJobResponse(null)).toBeNull();
    expect(parseJobResponse(undefined)).toBeNull();
    expect(parseJobResponse("nope")).toBeNull();
    expect(parseJobResponse(42)).toBeNull();
  });

  it("returns null when job key is absent or not an object", () => {
    expect(parseJobResponse({})).toBeNull();
    expect(parseJobResponse({ job: null })).toBeNull();
    expect(parseJobResponse({ job: "string" })).toBeNull();
  });
});
