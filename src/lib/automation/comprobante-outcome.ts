export interface ComprobanteAddSnapshot {
  rowsBefore: number;
  rowsAfter: number;
  errorTexts: string[];
}

export type ComprobanteAddOutcome = { ok: true } | { ok: false; error: string };

/**
 * Returns only the error texts that newly appeared between two snapshots of
 * `.formErrorContent` elements. SiRADIG renders those error nodes at the page
 * root (not inside the .ui-dialog), so a fresh post-click snapshot can also
 * include stale errors from earlier interactions — the diff against the
 * pre-click snapshot is what isolates the validation error caused by the
 * inner Agregar click.
 */
export function diffNewErrorTexts(before: string[], after: string[]): string[] {
  const beforeSet = new Set(before.map((t) => t.trim()).filter((t) => t.length > 0));
  return after.map((t) => t.trim()).filter((t) => t.length > 0 && !beforeSet.has(t));
}

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
