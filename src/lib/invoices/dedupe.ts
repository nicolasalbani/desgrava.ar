import type { InvoiceSource } from "@/generated/prisma/client";

/**
 * Build a deduplication key for an invoice. The triple
 * `(providerCuit, invoiceNumber, fiscalYear)` is the natural identity used by
 * both ARCA imports and manual create/upload paths to detect duplicates.
 */
export function invoiceDedupeKey(
  providerCuit: string,
  invoiceNumber: string | null,
  fiscalYear: number,
): string {
  return `${providerCuit}|${invoiceNumber ?? ""}|${fiscalYear}`;
}

/**
 * Decide whether a delete should be a soft delete (mark NO_DEDUCIBLE) or a
 * hard delete (remove the row). ARCA-sourced rows soft-delete so the next
 * pull's dedup check skips them; every other source hard-deletes.
 */
export function shouldSoftDelete(source: InvoiceSource): boolean {
  return source === "ARCA";
}
