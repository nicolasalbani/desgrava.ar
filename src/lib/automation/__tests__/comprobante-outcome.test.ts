import { describe, it, expect } from "vitest";
import { interpretComprobanteAddOutcome } from "@/lib/automation/comprobante-outcome";

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
