import { describe, it, expect } from "vitest";
import { extractOptimisticInput } from "@/hooks/use-arca-import-progress";

describe("extractOptimisticInput", () => {
  it("returns null when body is undefined", () => {
    expect(extractOptimisticInput(undefined)).toBeNull();
  });

  it("returns null when body has no jobType", () => {
    expect(extractOptimisticInput({ fiscalYear: 2026 })).toBeNull();
  });

  it("returns null when jobType is not a string", () => {
    expect(extractOptimisticInput({ jobType: 42 } as unknown as object)).toBeNull();
  });

  it("returns null when jobType is an empty string", () => {
    expect(extractOptimisticInput({ jobType: "" })).toBeNull();
  });

  it("extracts jobType + fiscalYear when both present", () => {
    expect(extractOptimisticInput({ jobType: "SUBMIT_INVOICE", fiscalYear: 2025 })).toEqual({
      jobType: "SUBMIT_INVOICE",
      fiscalYear: 2025,
    });
  });

  it("falls back to current year when fiscalYear is missing", () => {
    const result = extractOptimisticInput({ jobType: "SUBMIT_INVOICE" });
    expect(result?.jobType).toBe("SUBMIT_INVOICE");
    expect(result?.fiscalYear).toBe(new Date().getFullYear());
  });

  it("falls back to current year when fiscalYear is not a number", () => {
    const result = extractOptimisticInput({
      jobType: "SUBMIT_INVOICE",
      fiscalYear: "2026" as unknown as number,
    });
    expect(result?.fiscalYear).toBe(new Date().getFullYear());
  });

  it("ignores extra body fields", () => {
    expect(
      extractOptimisticInput({
        jobType: "SUBMIT_INVOICE",
        fiscalYear: 2026,
        invoiceId: "inv_123",
        receiptIds: ["r1", "r2"],
      }),
    ).toEqual({ jobType: "SUBMIT_INVOICE", fiscalYear: 2026 });
  });
});
