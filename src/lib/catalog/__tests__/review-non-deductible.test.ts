import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  prismaMock,
  classifyCategoryMock,
  lookupCuit360Mock,
  lookupCuitOnlineMock,
  isObviouslyNonDeductibleMock,
  sendCatalogReviewProposalMock,
} = vi.hoisted(() => ({
  prismaMock: {
    providerCatalog: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    catalogReviewProposal: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  classifyCategoryMock: vi.fn(),
  lookupCuit360Mock: vi.fn(),
  lookupCuitOnlineMock: vi.fn(),
  isObviouslyNonDeductibleMock: vi.fn(),
  sendCatalogReviewProposalMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/ocr/category-classifier", () => ({
  classifyCategory: classifyCategoryMock,
}));

vi.mock("@/lib/catalog/provider-catalog", () => ({
  lookupCuit360: lookupCuit360Mock,
  lookupCuitOnline: lookupCuitOnlineMock,
  isObviouslyNonDeductible: isObviouslyNonDeductibleMock,
}));

vi.mock("@/lib/telegram", () => ({
  sendCatalogReviewProposal: sendCatalogReviewProposalMock,
}));

import {
  aggregateInvoiceMetadata,
  approveCatalogProposal,
  rejectCatalogProposal,
  reviewNonDeductibleCatalog,
  MAX_REVIEWS_PER_RUN,
  REVIEW_SKIP_DAYS,
} from "@/lib/catalog/review-non-deductible";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no keyword match, no web info, no existing proposal
  isObviouslyNonDeductibleMock.mockReturnValue(false);
  lookupCuit360Mock.mockResolvedValue(null);
  lookupCuitOnlineMock.mockResolvedValue(null);
  prismaMock.catalogReviewProposal.findFirst.mockResolvedValue(null);
  prismaMock.catalogReviewProposal.create.mockResolvedValue({});
  prismaMock.providerCatalog.update.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
    Promise.all(ops.map((op) => (op instanceof Promise ? op : Promise.resolve(op)))),
  );
});

describe("aggregateInvoiceMetadata", () => {
  it("returns zero counts when there are no invoices", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const result = await aggregateInvoiceMetadata("30534357016");
    expect(result).toEqual({
      providerName: null,
      invoiceType: null,
      averageAmount: null,
      invoiceCount: 0,
      userCount: 0,
    });
  });

  it("picks the most-common providerName and invoiceType", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { providerName: "Clinica Alfa", invoiceType: "FACTURA_B", amount: 1000, userId: "u1" },
      { providerName: "Clinica Alfa", invoiceType: "FACTURA_B", amount: 2000, userId: "u2" },
      { providerName: "Clinica Beta", invoiceType: "FACTURA_C", amount: 3000, userId: "u1" },
    ]);
    const result = await aggregateInvoiceMetadata("30534357016");
    expect(result.providerName).toBe("Clinica Alfa");
    expect(result.invoiceType).toBe("FACTURA_B");
    expect(result.averageAmount).toBe(2000);
    expect(result.invoiceCount).toBe(3);
    expect(result.userCount).toBe(2);
  });

  it("ignores null provider names when computing the most-common", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { providerName: null, invoiceType: "FACTURA_B", amount: 1000, userId: "u1" },
      { providerName: "Clinica Alfa", invoiceType: "FACTURA_B", amount: 2000, userId: "u2" },
    ]);
    const result = await aggregateInvoiceMetadata("30534357016");
    expect(result.providerName).toBe("Clinica Alfa");
  });
});

describe("reviewNonDeductibleCatalog", () => {
  it("skips entries whose razonSocial matches the keyword list", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30111111111", razonSocial: "SUPERMERCADO COTO", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    isObviouslyNonDeductibleMock.mockReturnValue(true);

    const summary = await reviewNonDeductibleCatalog();

    expect(summary).toEqual({ processed: 1, flagged: 0, skipped: 1 });
    expect(classifyCategoryMock).not.toHaveBeenCalled();
    expect(sendCatalogReviewProposalMock).not.toHaveBeenCalled();
    expect(prismaMock.providerCatalog.update).toHaveBeenCalledWith({
      where: { cuit: "30111111111" },
      data: { lastReviewedAt: expect.any(Date) },
    });
  });

  it("skips entries that already have an open proposal", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30222222222", razonSocial: "Clinica X", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    prismaMock.catalogReviewProposal.findFirst.mockResolvedValue({
      id: "p1",
      cuit: "30222222222",
    });

    const summary = await reviewNonDeductibleCatalog();

    expect(summary).toEqual({ processed: 1, flagged: 0, skipped: 1 });
    expect(classifyCategoryMock).not.toHaveBeenCalled();
    expect(prismaMock.catalogReviewProposal.create).not.toHaveBeenCalled();
  });

  it("skips entries with zero affected invoices", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30333333333", razonSocial: "Clinica Y", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await reviewNonDeductibleCatalog();

    expect(summary).toEqual({ processed: 1, flagged: 0, skipped: 1 });
    expect(classifyCategoryMock).not.toHaveBeenCalled();
    expect(prismaMock.providerCatalog.update).toHaveBeenCalled();
  });

  it("skips entries still classified as NO_DEDUCIBLE after re-classification", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30444444444", razonSocial: "Empresa Z", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([
      { providerName: "Empresa Z", invoiceType: "FACTURA_B", amount: 1000, userId: "u1" },
    ]);
    classifyCategoryMock.mockResolvedValue("NO_DEDUCIBLE");

    const summary = await reviewNonDeductibleCatalog();

    expect(summary).toEqual({ processed: 1, flagged: 0, skipped: 1 });
    expect(sendCatalogReviewProposalMock).not.toHaveBeenCalled();
    expect(prismaMock.catalogReviewProposal.create).not.toHaveBeenCalled();
  });

  it("flags, sends a Telegram message, and creates a proposal when a deductible category is found", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30555555555", razonSocial: "Clinica Salud", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([
      { providerName: "Clinica Salud", invoiceType: "FACTURA_B", amount: 5000, userId: "u1" },
      { providerName: "Clinica Salud", invoiceType: "FACTURA_B", amount: 7000, userId: "u2" },
    ]);
    lookupCuit360Mock.mockResolvedValue({
      razonSocial: "CLINICA SALUD SA",
      actividades: ["SERVICIOS DE ATENCIÓN MÉDICA"],
    });
    classifyCategoryMock.mockResolvedValue("GASTOS_MEDICOS");
    sendCatalogReviewProposalMock.mockResolvedValue(12345);

    const summary = await reviewNonDeductibleCatalog();

    expect(summary).toEqual({ processed: 1, flagged: 1, skipped: 0 });
    expect(sendCatalogReviewProposalMock).toHaveBeenCalledWith({
      cuit: "30555555555",
      razonSocial: "CLINICA SALUD SA",
      proposedCategory: "GASTOS_MEDICOS",
      invoiceCount: 2,
      userCount: 2,
      activityDescription: "SERVICIOS DE ATENCIÓN MÉDICA",
    });
    expect(prismaMock.catalogReviewProposal.create).toHaveBeenCalledWith({
      data: {
        cuit: "30555555555",
        proposedCategory: "GASTOS_MEDICOS",
        telegramMessageId: "12345",
      },
    });
  });

  it("uses cuitonline as fallback when sistemas360 returns null", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([
      { cuit: "30666666666", razonSocial: "Centro Ortopédico", deductionCategory: "NO_DEDUCIBLE" },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        providerName: "Centro Ortopédico",
        invoiceType: "FACTURA_B",
        amount: 8000,
        userId: "u1",
      },
    ]);
    lookupCuit360Mock.mockResolvedValue(null);
    lookupCuitOnlineMock.mockResolvedValue({
      razonSocial: "CENTRAL ORTOPEDICA SRL",
      actividades: ["COMERCIO AL POR MENOR DE PRODUCTOS ORTOPÉDICOS"],
    });
    classifyCategoryMock.mockResolvedValue("GASTOS_MEDICOS");
    sendCatalogReviewProposalMock.mockResolvedValue(99);

    const summary = await reviewNonDeductibleCatalog();

    expect(summary.flagged).toBe(1);
    expect(lookupCuitOnlineMock).toHaveBeenCalled();
  });

  it("filters candidates by the 30-day re-review cutoff", async () => {
    prismaMock.providerCatalog.findMany.mockResolvedValue([]);
    await reviewNonDeductibleCatalog();

    const call = prismaMock.providerCatalog.findMany.mock.calls[0][0];
    expect(call.where.deductionCategory).toBe("NO_DEDUCIBLE");
    expect(call.where.OR).toEqual([
      { lastReviewedAt: null },
      { lastReviewedAt: { lt: expect.any(Date) } },
    ]);
    const cutoff = call.where.OR[1].lastReviewedAt.lt as Date;
    const diffMs = Date.now() - cutoff.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(REVIEW_SKIP_DAYS - 1);
    expect(diffDays).toBeLessThan(REVIEW_SKIP_DAYS + 1);
    expect(call.take).toBe(MAX_REVIEWS_PER_RUN);
  });
});

describe("approveCatalogProposal", () => {
  it("updates the catalog, invoices, and proposal in a single transaction", async () => {
    prismaMock.catalogReviewProposal.findFirst.mockResolvedValue({
      id: "p1",
      cuit: "30777777777",
      proposedCategory: "GASTOS_MEDICOS",
      telegramMessageId: "42",
    });
    prismaMock.invoice.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    prismaMock.user.findMany.mockResolvedValue([{ email: "a@test.com" }, { email: "b@test.com" }]);

    const result = await approveCatalogProposal("30777777777");

    expect(result.status).toBe("approved");
    expect(result.newCategory).toBe("GASTOS_MEDICOS");
    expect(result.affectedUserEmails).toEqual(["a@test.com", "b@test.com"]);
    expect(result.telegramMessageId).toBe(42);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns already_resolved when no open proposal exists but a resolved one does", async () => {
    prismaMock.catalogReviewProposal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "p-old", telegramMessageId: "7", resolvedAt: new Date() });

    const result = await approveCatalogProposal("30888888888");
    expect(result.status).toBe("already_resolved");
    expect(result.telegramMessageId).toBe(7);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns not_found when no proposal exists at all", async () => {
    prismaMock.catalogReviewProposal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await approveCatalogProposal("30999999999");
    expect(result.status).toBe("not_found");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("filters out null user emails", async () => {
    prismaMock.catalogReviewProposal.findFirst.mockResolvedValue({
      id: "p1",
      cuit: "30777777777",
      proposedCategory: "GASTOS_MEDICOS",
      telegramMessageId: null,
    });
    prismaMock.invoice.findMany.mockResolvedValue([{ userId: "u1" }]);
    prismaMock.user.findMany.mockResolvedValue([{ email: null }]);

    const result = await approveCatalogProposal("30777777777");
    expect(result.affectedUserEmails).toEqual([]);
  });
});

describe("rejectCatalogProposal", () => {
  it("marks the proposal rejected and refreshes lastReviewedAt without touching invoices", async () => {
    prismaMock.catalogReviewProposal.findFirst.mockResolvedValue({
      id: "p1",
      cuit: "30444444444",
      proposedCategory: "GASTOS_MEDICOS",
      telegramMessageId: "77",
    });

    const result = await rejectCatalogProposal("30444444444");

    expect(result.status).toBe("rejected");
    expect(result.telegramMessageId).toBe(77);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("returns already_resolved when a prior resolution exists", async () => {
    prismaMock.catalogReviewProposal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "p-old", telegramMessageId: null, resolvedAt: new Date() });

    const result = await rejectCatalogProposal("30444444444");
    expect(result.status).toBe("already_resolved");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns not_found when no proposal exists at all", async () => {
    prismaMock.catalogReviewProposal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await rejectCatalogProposal("30444444444");
    expect(result.status).toBe("not_found");
  });
});
