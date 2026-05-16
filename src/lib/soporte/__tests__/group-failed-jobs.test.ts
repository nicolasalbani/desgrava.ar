import { describe, it, expect } from "vitest";
import { groupFailedJobs, getGroupKey, type FailedJobRaw } from "@/lib/soporte/group-failed-jobs";

const LABELS = {
  SUBMIT_INVOICE: "Envío de factura a SiRADIG",
  SUBMIT_DOMESTIC_DEDUCTION: "Envío de deducción de servicio doméstico",
  PULL_COMPROBANTES: "Importación de comprobantes",
};

function baseJob(overrides: Partial<FailedJobRaw> = {}): FailedJobRaw {
  return {
    id: "job-1",
    jobType: "SUBMIT_INVOICE",
    errorMessage: "boom",
    currentStep: "agregar",
    fiscalYear: 2026,
    createdAt: new Date("2026-05-14T10:00:00Z"),
    invoiceId: "inv-1",
    presentacionId: null,
    employerId: null,
    familyDependentId: null,
    invoice: { providerName: "PIETRUSZKA DIANA MYRIAN", providerCuit: "20-12345678-9" },
    domesticReceipts: [],
    presentacion: null,
    employer: null,
    ...overrides,
  };
}

describe("getGroupKey", () => {
  it("uses invoiceId for SUBMIT_INVOICE", () => {
    expect(getGroupKey(baseJob({ id: "a" }))).toBe("SUBMIT_INVOICE::inv-1::2026");
  });

  it("falls back to domesticWorker id for domestic jobs without other ids", () => {
    const key = getGroupKey(
      baseJob({
        jobType: "SUBMIT_DOMESTIC_DEDUCTION",
        invoiceId: null,
        invoice: null,
        domesticReceipts: [
          { id: "r1", periodo: "2026-03", domesticWorker: { id: "w-7", apellidoNombre: "Pérez" } },
        ],
      }),
    );
    expect(key).toBe("SUBMIT_DOMESTIC_DEDUCTION::w-7::2026");
  });

  it("uses 'none' subject when nothing identifies the related entity", () => {
    const key = getGroupKey(
      baseJob({ jobType: "PULL_COMPROBANTES", invoiceId: null, invoice: null }),
    );
    expect(key).toBe("PULL_COMPROBANTES::none::2026");
  });

  it("does not group across different fiscal years for the same invoice", () => {
    const a = getGroupKey(baseJob({ fiscalYear: 2025 }));
    const b = getGroupKey(baseJob({ fiscalYear: 2026 }));
    expect(a).not.toBe(b);
  });
});

describe("groupFailedJobs", () => {
  it("collapses retries of the same invoice into one group", () => {
    const result = groupFailedJobs(
      [
        baseJob({ id: "j-1", createdAt: new Date("2026-05-14T08:00:00Z"), errorMessage: "err A" }),
        baseJob({ id: "j-2", createdAt: new Date("2026-05-14T09:00:00Z"), errorMessage: "err B" }),
        baseJob({ id: "j-3", createdAt: new Date("2026-05-14T10:00:00Z"), errorMessage: "err C" }),
      ],
      { jobTypeLabels: LABELS },
    );

    expect(result).toHaveLength(1);
    expect(result[0].attempts).toBe(3);
    expect(result[0].jobId).toBe("j-3"); // latest
    expect(result[0].latestError).toBe("err C");
    expect(result[0].previousErrors).toEqual(["err B", "err A"]);
    expect(result[0].lastFailedAt).toBe("2026-05-14T10:00:00.000Z");
    expect(result[0].firstFailedAt).toBe("2026-05-14T08:00:00.000Z");
  });

  it("keeps distinct problems separate", () => {
    const result = groupFailedJobs(
      [baseJob({ id: "a", invoiceId: "inv-1" }), baseJob({ id: "b", invoiceId: "inv-2" })],
      { jobTypeLabels: LABELS },
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.jobId).sort()).toEqual(["a", "b"]);
  });

  it("dedupes identical errors across attempts", () => {
    const result = groupFailedJobs(
      [
        baseJob({ id: "j-1", createdAt: new Date("2026-05-14T08:00:00Z"), errorMessage: "same" }),
        baseJob({ id: "j-2", createdAt: new Date("2026-05-14T09:00:00Z"), errorMessage: "same" }),
      ],
      { jobTypeLabels: LABELS },
    );
    expect(result[0].latestError).toBe("same");
    expect(result[0].previousErrors).toEqual([]);
  });

  it("caps previousErrors at maxPreviousErrors", () => {
    const jobs: FailedJobRaw[] = [];
    for (let i = 0; i < 8; i++) {
      jobs.push(
        baseJob({
          id: `j-${i}`,
          createdAt: new Date(`2026-05-14T0${i}:00:00Z`),
          errorMessage: `err ${i}`,
        }),
      );
    }
    const result = groupFailedJobs(jobs, { jobTypeLabels: LABELS, maxPreviousErrors: 2 });
    expect(result[0].attempts).toBe(8);
    expect(result[0].previousErrors).toHaveLength(2);
  });

  it("populates relatedEntity from the latest job's invoice/receipt/etc.", () => {
    const result = groupFailedJobs([baseJob({})], { jobTypeLabels: LABELS });
    expect(result[0].relatedEntity).toBe("PIETRUSZKA DIANA MYRIAN");
    expect(result[0].typeLabel).toBe("Envío de factura a SiRADIG");
  });

  it("returns groups sorted newest-first and respects maxGroups", () => {
    const result = groupFailedJobs(
      [
        baseJob({ id: "old", invoiceId: "x", createdAt: new Date("2026-05-01T00:00:00Z") }),
        baseJob({ id: "mid", invoiceId: "y", createdAt: new Date("2026-05-10T00:00:00Z") }),
        baseJob({ id: "new", invoiceId: "z", createdAt: new Date("2026-05-14T00:00:00Z") }),
      ],
      { jobTypeLabels: LABELS, maxGroups: 2 },
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.jobId)).toEqual(["new", "mid"]);
  });

  it("falls back to job type when the label is unknown", () => {
    const result = groupFailedJobs([baseJob({ jobType: "WEIRD_NEW_TYPE" })], {
      jobTypeLabels: LABELS,
    });
    expect(result[0].typeLabel).toBe("WEIRD_NEW_TYPE");
  });
});
