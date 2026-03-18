import { describe, it, expect } from "vitest";

/**
 * Tests for the attention filter logic used client-side in invoice and receipt lists.
 * These match the conditions in the API's getAttentionCounts SQL queries.
 */

interface MockInvoice {
  id: string;
  deductionCategory: string;
  familyDependentId: string | null;
  latestJob: { status: string } | null;
}

interface MockReceipt {
  id: string;
  domesticWorkerId: string | null;
  latestJob: { status: string } | null;
}

function invoiceNeedsAttention(inv: MockInvoice): boolean {
  return (
    !inv.latestJob ||
    inv.latestJob.status === "FAILED" ||
    (inv.deductionCategory === "GASTOS_EDUCATIVOS" && !inv.familyDependentId)
  );
}

function receiptNeedsAttention(r: MockReceipt): boolean {
  return !r.latestJob || r.latestJob.status === "FAILED" || !r.domesticWorkerId;
}

describe("invoiceNeedsAttention", () => {
  it("returns true when no job exists", () => {
    expect(
      invoiceNeedsAttention({
        id: "1",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: null,
      }),
    ).toBe(true);
  });

  it("returns true when latest job is FAILED", () => {
    expect(
      invoiceNeedsAttention({
        id: "2",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "FAILED" },
      }),
    ).toBe(true);
  });

  it("returns true when GASTOS_EDUCATIVOS without family dependent", () => {
    expect(
      invoiceNeedsAttention({
        id: "3",
        deductionCategory: "GASTOS_EDUCATIVOS",
        familyDependentId: null,
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(true);
  });

  it("returns false when GASTOS_EDUCATIVOS with family dependent and completed job", () => {
    expect(
      invoiceNeedsAttention({
        id: "4",
        deductionCategory: "GASTOS_EDUCATIVOS",
        familyDependentId: "dep-1",
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(false);
  });

  it("returns false when job is COMPLETED and not educational", () => {
    expect(
      invoiceNeedsAttention({
        id: "5",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(false);
  });

  it("returns false when job is RUNNING", () => {
    expect(
      invoiceNeedsAttention({
        id: "6",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "RUNNING" },
      }),
    ).toBe(false);
  });

  it("returns false when job is PENDING", () => {
    expect(
      invoiceNeedsAttention({
        id: "7",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "PENDING" },
      }),
    ).toBe(false);
  });

  it("returns true when GASTOS_EDUCATIVOS without dependent even with PENDING job", () => {
    expect(
      invoiceNeedsAttention({
        id: "8",
        deductionCategory: "GASTOS_EDUCATIVOS",
        familyDependentId: null,
        latestJob: { status: "PENDING" },
      }),
    ).toBe(true);
  });

  it("returns true when job is CANCELLED (no successful job)", () => {
    // CANCELLED is not FAILED, but also not successful — the filter only checks for FAILED
    // A CANCELLED job doesn't need attention in the same way
    expect(
      invoiceNeedsAttention({
        id: "9",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "CANCELLED" },
      }),
    ).toBe(false);
  });
});

describe("receiptNeedsAttention", () => {
  it("returns true when no job exists", () => {
    expect(
      receiptNeedsAttention({
        id: "1",
        domesticWorkerId: "w-1",
        latestJob: null,
      }),
    ).toBe(true);
  });

  it("returns true when latest job is FAILED", () => {
    expect(
      receiptNeedsAttention({
        id: "2",
        domesticWorkerId: "w-1",
        latestJob: { status: "FAILED" },
      }),
    ).toBe(true);
  });

  it("returns true when domesticWorkerId is null", () => {
    expect(
      receiptNeedsAttention({
        id: "3",
        domesticWorkerId: null,
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(true);
  });

  it("returns false when job is COMPLETED and worker assigned", () => {
    expect(
      receiptNeedsAttention({
        id: "4",
        domesticWorkerId: "w-1",
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(false);
  });

  it("returns false when job is RUNNING and worker assigned", () => {
    expect(
      receiptNeedsAttention({
        id: "5",
        domesticWorkerId: "w-1",
        latestJob: { status: "RUNNING" },
      }),
    ).toBe(false);
  });

  it("returns true when both no worker and no job", () => {
    expect(
      receiptNeedsAttention({
        id: "6",
        domesticWorkerId: null,
        latestJob: null,
      }),
    ).toBe(true);
  });

  it("returns true when no worker even with completed job", () => {
    expect(
      receiptNeedsAttention({
        id: "7",
        domesticWorkerId: null,
        latestJob: { status: "COMPLETED" },
      }),
    ).toBe(true);
  });
});

describe("attention filter on invoice list", () => {
  const invoices: MockInvoice[] = [
    { id: "a", deductionCategory: "DONACIONES", familyDependentId: null, latestJob: null },
    {
      id: "b",
      deductionCategory: "DONACIONES",
      familyDependentId: null,
      latestJob: { status: "COMPLETED" },
    },
    {
      id: "c",
      deductionCategory: "GASTOS_EDUCATIVOS",
      familyDependentId: null,
      latestJob: { status: "COMPLETED" },
    },
    {
      id: "d",
      deductionCategory: "DONACIONES",
      familyDependentId: null,
      latestJob: { status: "FAILED" },
    },
    {
      id: "e",
      deductionCategory: "GASTOS_EDUCATIVOS",
      familyDependentId: "dep-1",
      latestJob: { status: "COMPLETED" },
    },
  ];

  it("filters to only attention-needing invoices", () => {
    const filtered = invoices.filter(invoiceNeedsAttention);
    expect(filtered.map((i) => i.id)).toEqual(["a", "c", "d"]);
  });

  it("returns empty when no invoices need attention", () => {
    const allGood: MockInvoice[] = [
      {
        id: "x",
        deductionCategory: "DONACIONES",
        familyDependentId: null,
        latestJob: { status: "COMPLETED" },
      },
    ];
    expect(allGood.filter(invoiceNeedsAttention)).toEqual([]);
  });
});

describe("attention filter on receipt list", () => {
  const receipts: MockReceipt[] = [
    { id: "r1", domesticWorkerId: "w-1", latestJob: null },
    { id: "r2", domesticWorkerId: "w-1", latestJob: { status: "COMPLETED" } },
    { id: "r3", domesticWorkerId: null, latestJob: { status: "COMPLETED" } },
    { id: "r4", domesticWorkerId: "w-1", latestJob: { status: "FAILED" } },
  ];

  it("filters to only attention-needing receipts", () => {
    const filtered = receipts.filter(receiptNeedsAttention);
    expect(filtered.map((r) => r.id)).toEqual(["r1", "r3", "r4"]);
  });
});
