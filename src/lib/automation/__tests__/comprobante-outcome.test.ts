import { describe, it, expect } from "vitest";
import {
  diffNewErrorTexts,
  interpretComprobanteAddOutcome,
} from "@/lib/automation/comprobante-outcome";

describe("interpretComprobanteAddOutcome", () => {
  it("returns ok when a new row was appended to the comprobantes grid", () => {
    expect(interpretComprobanteAddOutcome({ rowsBefore: 0, rowsAfter: 1, errorTexts: [] })).toEqual(
      { ok: true },
    );
  });

  it("returns ok when a row was added even if a stale error message is visible", () => {
    expect(
      interpretComprobanteAddOutcome({
        rowsBefore: 2,
        rowsAfter: 3,
        errorTexts: ["Error que ya estaba en pantalla"],
      }),
    ).toEqual({ ok: true });
  });

  it("surfaces dialog validation errors when no row was added", () => {
    const result = interpretComprobanteAddOutcome({
      rowsBefore: 0,
      rowsAfter: 0,
      errorTexts: ["Debe ingresar fecha"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Comprobante no agregado: Debe ingresar fecha");
    }
  });

  it("joins multiple error texts with a pipe separator", () => {
    const result = interpretComprobanteAddOutcome({
      rowsBefore: 1,
      rowsAfter: 1,
      errorTexts: ["Debe ingresar fecha", "Monto invalido"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Comprobante no agregado: Debe ingresar fecha | Monto invalido");
    }
  });

  it("returns a generic failure when the dialog was force-closed without an error message", () => {
    // Regression: matches the GASTOS_MEDICOS submission failure from ticket
    // cmp5f78v1000304laq5zq9b1v — the inner Agregar click never registered the row,
    // dismissDialogOverlay nuked the dialog, and the outer Guardar surfaced the
    // unhelpful "Debe agregar Comprobantes" message.
    const result = interpretComprobanteAddOutcome({
      rowsBefore: 0,
      rowsAfter: 0,
      errorTexts: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("SiRADIG no registró la fila");
    }
  });

  it("ignores whitespace-only error texts", () => {
    const result = interpretComprobanteAddOutcome({
      rowsBefore: 0,
      rowsAfter: 0,
      errorTexts: ["   ", "\n", "\t"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("SiRADIG no registró la fila");
    }
  });
});

describe("diffNewErrorTexts", () => {
  it("returns all errors when nothing was previously visible", () => {
    expect(diffNewErrorTexts([], ["nuevo error"])).toEqual(["nuevo error"]);
  });

  it("returns only newly-appearing errors", () => {
    expect(diffNewErrorTexts(["viejo"], ["viejo", "nuevo"])).toEqual(["nuevo"]);
  });

  it("returns empty when no new errors appeared", () => {
    expect(diffNewErrorTexts(["viejo"], ["viejo"])).toEqual([]);
  });

  it("ignores whitespace-only entries on both sides", () => {
    expect(diffNewErrorTexts(["  "], ["\n", "real"])).toEqual(["real"]);
  });

  it("trims entries before comparison so equivalent texts are treated as unchanged", () => {
    expect(diffNewErrorTexts(["error"], [" error ", "otro"])).toEqual(["otro"]);
  });

  it("isolates the SiRADIG date-window error from ticket cmp5f78v1000304laq5zq9b1v", () => {
    // Regression: GASTOS_MEDICOS submission with invoiceDate=2026-05-13 for
    // fiscalMonth=3 (March). SiRADIG renders the validation error as a
    // page-root .formErrorContent (outside the .ui-dialog), so a fresh post-
    // click snapshot may also pick up unrelated errors elsewhere on the page.
    // The diff isolates the one that the inner Agregar click just produced.
    const before: string[] = [];
    const after = [
      "La fecha debe estar dentro del mes indicado (Marzo), el mes anterior (Febrero) o el siguiente (Abril)",
    ];
    expect(diffNewErrorTexts(before, after)).toEqual(after);
  });
});
