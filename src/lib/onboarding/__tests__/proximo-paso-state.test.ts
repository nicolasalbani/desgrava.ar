import { describe, it, expect } from "vitest";
import { deriveProximoPasoState } from "@/lib/onboarding/proximo-paso-state";

const baseInput = {
  hasRunningImport: false,
  pendingInvoiceCount: 0,
  pendingReceiptCount: 0,
  totalDeducibleInvoices: 0,
  totalDeducibleReceipts: 0,
  hasUnregisteredWorker: false,
  allSubmitted: false,
  currentMonth: 4,
};

describe("deriveProximoPasoState", () => {
  it("returns 'importing' variant when an import job is running (highest priority)", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      hasRunningImport: true,
      pendingInvoiceCount: 5,
      totalDeducibleInvoices: 10,
    });
    expect(state.variant).toBe("importing");
    expect(state.title).toContain("Estamos descargando");
    expect(state.ctas[0].action).toBe("import-comprobantes");
  });

  it("returns 'review-month' variant with month name when there are pending invoices", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingInvoiceCount: 3,
      totalDeducibleInvoices: 10,
      currentMonth: 3,
    });
    expect(state.variant).toBe("review-month");
    expect(state.title).toContain("marzo");
    expect(state.body).toContain("3 comprobantes");
    expect(state.ctas).toHaveLength(2);
    expect(state.ctas[0].href).toBe("/comprobantes");
    expect(state.ctas[1].action).toBe("import-comprobantes");
  });

  it("uses singular 'comprobante' when pendingInvoiceCount is 1", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingInvoiceCount: 1,
      totalDeducibleInvoices: 5,
    });
    expect(state.body).toContain("1 comprobante esperan");
  });

  it("returns 'no-invoices' variant when no deducible invoices or recibos exist", () => {
    const state = deriveProximoPasoState(baseInput);
    expect(state.variant).toBe("no-invoices");
    expect(state.ctas[0].action).toBe("import-comprobantes");
  });

  it("returns 'ready-to-present' variant when all deducibles are submitted", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingInvoiceCount: 0,
      totalDeducibleInvoices: 5,
      allSubmitted: true,
    });
    expect(state.variant).toBe("ready-to-present");
    expect(state.ctas[0].href).toBe("/presentaciones");
  });

  it("returns 'all-set' variant otherwise (no CTAs)", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      totalDeducibleInvoices: 5,
      allSubmitted: false,
    });
    expect(state.variant).toBe("all-set");
    expect(state.ctas).toHaveLength(0);
  });

  it("priority: importing beats pending invoices", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      hasRunningImport: true,
      pendingInvoiceCount: 5,
      totalDeducibleInvoices: 10,
    });
    expect(state.variant).toBe("importing");
  });

  it("priority: pending invoices beats no-invoices when both could match", () => {
    // Edge case: pendingInvoiceCount > 0 but totalDeducibleInvoices === 0 shouldn't happen,
    // but pendingInvoiceCount takes priority either way.
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingInvoiceCount: 1,
      totalDeducibleInvoices: 0,
    });
    expect(state.variant).toBe("review-month");
  });

  it("falls back gracefully when currentMonth is out of range", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingInvoiceCount: 1,
      totalDeducibleInvoices: 5,
      currentMonth: 99,
    });
    expect(state.title).toContain("este mes");
  });

  describe("recibos branches", () => {
    it("returns 'review-recibos' when there are pending receipts and worker is registered", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingReceiptCount: 4,
        totalDeducibleReceipts: 4,
      });
      expect(state.variant).toBe("review-recibos");
      expect(state.title).toBe("Tenés 4 recibos sin desgravar");
      expect(state.body).toContain("personal doméstico");
      expect(state.ctas).toHaveLength(1);
      expect(state.ctas[0].href).toBe("/recibos");
      expect(state.ctas[0].variant).toBe("primary");
    });

    it("uses singular 'recibo' in 'review-recibos' when pendingReceiptCount is 1", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingReceiptCount: 1,
        totalDeducibleReceipts: 1,
      });
      expect(state.title).toBe("Tenés 1 recibo sin desgravar");
    });

    it("returns 'register-trabajador' when there are pending receipts but worker is missing", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingReceiptCount: 2,
        totalDeducibleReceipts: 2,
        hasUnregisteredWorker: true,
      });
      expect(state.variant).toBe("register-trabajador");
      expect(state.title).toBe("Registrá a tu trabajador");
      expect(state.body).toContain("2 recibos");
      expect(state.ctas[0].href).toBe("/trabajadores");
    });

    it("uses singular 'recibo' in 'register-trabajador' when pendingReceiptCount is 1", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingReceiptCount: 1,
        totalDeducibleReceipts: 1,
        hasUnregisteredWorker: true,
      });
      expect(state.body).toContain("1 recibo ");
    });

    it("priority: review-month beats review-recibos when both have pending", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingInvoiceCount: 2,
        pendingReceiptCount: 5,
        totalDeducibleInvoices: 2,
        totalDeducibleReceipts: 5,
      });
      expect(state.variant).toBe("review-month");
    });

    it("priority: review-month beats register-trabajador when both could match", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingInvoiceCount: 2,
        pendingReceiptCount: 5,
        totalDeducibleInvoices: 2,
        totalDeducibleReceipts: 5,
        hasUnregisteredWorker: true,
      });
      expect(state.variant).toBe("review-month");
    });

    it("priority: register-trabajador beats review-recibos when worker is missing", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        pendingReceiptCount: 3,
        totalDeducibleReceipts: 3,
        hasUnregisteredWorker: true,
      });
      expect(state.variant).toBe("register-trabajador");
    });

    it("priority: importing beats recibos branches", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        hasRunningImport: true,
        pendingReceiptCount: 3,
        totalDeducibleReceipts: 3,
        hasUnregisteredWorker: true,
      });
      expect(state.variant).toBe("importing");
    });

    it("returns 'ready-to-present' when only submitted receipts exist and allSubmitted is true", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        totalDeducibleReceipts: 5,
        allSubmitted: true,
      });
      expect(state.variant).toBe("ready-to-present");
    });

    it("does not return 'no-invoices' when only deducible receipts exist", () => {
      const state = deriveProximoPasoState({
        ...baseInput,
        totalDeducibleReceipts: 5,
      });
      expect(state.variant).toBe("all-set");
    });
  });
});
