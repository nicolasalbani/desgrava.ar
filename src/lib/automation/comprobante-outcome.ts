export interface ComprobanteAddSnapshot {
  rowsBefore: number;
  rowsAfter: number;
  errorTexts: string[];
}

export type ComprobanteAddOutcome = { ok: true } | { ok: false; error: string };

export function interpretComprobanteAddOutcome(
  snapshot: ComprobanteAddSnapshot,
): ComprobanteAddOutcome {
  if (snapshot.rowsAfter > snapshot.rowsBefore) {
    return { ok: true };
  }

  const visibleErrors = snapshot.errorTexts.map((t) => t.trim()).filter((t) => t.length > 0);

  if (visibleErrors.length > 0) {
    return { ok: false, error: `Comprobante no agregado: ${visibleErrors.join(" | ")}` };
  }

  return {
    ok: false,
    error:
      "El comprobante no se pudo agregar al detalle (SiRADIG no registró la fila después de presionar Agregar).",
  };
}
