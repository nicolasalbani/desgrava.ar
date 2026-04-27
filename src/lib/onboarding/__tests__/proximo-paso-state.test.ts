import { describe, it, expect } from "vitest";
import { deriveProximoPasoState } from "@/lib/onboarding/proximo-paso-state";

const baseInput = {
  hasRunningImport: false,
  pendingCount: 0,
  totalDeducible: 0,
  allSubmitted: false,
  currentMonth: 4,
};

describe("deriveProximoPasoState", () => {
  it("returns 'importing' variant when an import job is running (highest priority)", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      hasRunningImport: true,
      pendingCount: 5,
      totalDeducible: 10,
    });
    expect(state.variant).toBe("importing");
    expect(state.title).toContain("Estamos descargando");
    expect(state.ctas[0].action).toBe("import-comprobantes");
  });

  it("returns 'review-month' variant with month name when there are pending invoices", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingCount: 3,
      totalDeducible: 10,
      currentMonth: 3,
    });
    expect(state.variant).toBe("review-month");
    expect(state.title).toContain("marzo");
    expect(state.body).toContain("3 comprobantes");
    expect(state.ctas).toHaveLength(2);
    expect(state.ctas[0].href).toBe("/facturas");
    expect(state.ctas[1].action).toBe("import-comprobantes");
  });

  it("uses singular 'comprobante' when pendingCount is 1", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingCount: 1,
      totalDeducible: 5,
    });
    expect(state.body).toContain("1 comprobante esperan");
  });

  it("returns 'no-invoices' variant when totalDeducible is 0", () => {
    const state = deriveProximoPasoState(baseInput);
    expect(state.variant).toBe("no-invoices");
    expect(state.ctas[0].action).toBe("import-comprobantes");
  });

  it("returns 'ready-to-present' variant when all deducibles are submitted", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingCount: 0,
      totalDeducible: 5,
      allSubmitted: true,
    });
    expect(state.variant).toBe("ready-to-present");
    expect(state.ctas[0].href).toBe("/presentaciones");
  });

  it("returns 'all-set' variant otherwise (no CTAs)", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      totalDeducible: 5,
      allSubmitted: false,
    });
    expect(state.variant).toBe("all-set");
    expect(state.ctas).toHaveLength(0);
  });

  it("priority: importing beats pending invoices", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      hasRunningImport: true,
      pendingCount: 5,
      totalDeducible: 10,
    });
    expect(state.variant).toBe("importing");
  });

  it("priority: pending invoices beats no-invoices when both could match", () => {
    // Edge case: pendingCount > 0 but totalDeducible === 0 shouldn't happen,
    // but pendingCount takes priority either way.
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingCount: 1,
      totalDeducible: 0,
    });
    expect(state.variant).toBe("review-month");
  });

  it("falls back gracefully when currentMonth is out of range", () => {
    const state = deriveProximoPasoState({
      ...baseInput,
      pendingCount: 1,
      totalDeducible: 5,
      currentMonth: 99,
    });
    expect(state.title).toContain("este mes");
  });
});
