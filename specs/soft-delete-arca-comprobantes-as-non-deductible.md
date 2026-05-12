---
title: Soft-delete ARCA comprobantes as non-deductible
status: implemented
priority: medium
---

## Summary

When a user deletes a comprobante that was imported from ARCA, the next daily/manual ARCA pull re-imports it because the dedup check (`providerCuit + invoiceNumber + fiscalYear`) no longer finds a matching row. This forces users to repeatedly delete the same junk providers (supermarkets misclassified into a deductible category, comprobantes the user doesn't want to deduct, etc.). Instead, deleting an ARCA-sourced comprobante should mark it as `NO_DEDUCIBLE` (soft delete): the row stays in the DB to block future re-imports, gets excluded from tax calculations and SiRADIG submission via existing `NO_DEDUCIBLE` plumbing, and shows in the invoice list with the existing muted badge. Manual / PDF / OCR / email uploads stay hard-deletes — those rows have no re-import problem.

## Acceptance Criteria

### Delete behavior

- [ ] `DELETE /api/comprobantes/[id]` checks the row's `source` field
- [ ] If `source = "ARCA"`, the row is **updated** to `deductionCategory = "NO_DEDUCIBLE"` (no row deletion, no automation jobs cascade delete) and the response is `{ success: true, softDeleted: true }`
- [ ] If `source ∈ { MANUAL, PDF, OCR, EMAIL }`, the existing hard-delete path runs unchanged (automation jobs deleted, storage file removed, row deleted)
- [ ] Soft-deleted rows keep their original `providerCuit`, `providerName`, `invoiceNumber`, `invoiceDate`, `amount`, `fiscalYear`, `fiscalMonth`, `source = "ARCA"` — only `deductionCategory` changes
- [ ] If the row is already `NO_DEDUCIBLE` and `source = "ARCA"`, the DELETE call is a no-op (returns success)
- [ ] If the row has `familyDependentId` set, it is cleared on soft-delete (consistent with the existing rule that non-`GASTOS_EDUCATIVOS` rows have no dependent link)

### Re-import behavior (verifies the fix)

- [ ] On the next `PULL_COMPROBANTES` run, the soft-deleted comprobante is reported as a duplicate and skipped — its dedup key is already in `existingKeys` regardless of category

### Recovery via manual upload

- [ ] `POST /api/comprobantes` (manual create) and `POST /api/comprobantes/upload` (PDF upload) detect when the submitted comprobante matches an existing soft-deleted ARCA row by `userId + providerCuit + invoiceNumber + fiscalYear`, **invoiceNumber is required for the match** (null/empty invoiceNumber falls through to normal create behavior)
- [ ] When a match is found, the existing row is updated in-place with the new submission's `deductionCategory`, `source` (`MANUAL` / `PDF` / `OCR` / `EMAIL`), `description`, `fileStorageKey`, `originalFilename`, `ocrConfidence`, `amount`, and `invoiceDate` — instead of inserting a new row
- [ ] After overwrite, the row is no longer `NO_DEDUCIBLE` and reappears in totals / metrics / SiRADIG-eligible lists
- [ ] The match check ignores `source` — it works whether the existing row is ARCA-sourced or already-manually-created

### Existing recovery via bulk edit

- [ ] Soft-deleted rows continue to appear in the invoice list with the existing "No deducible" muted badge (no change here — current `NO_DEDUCIBLE` rendering already handles this)
- [ ] Users can select a soft-deleted row and reclassify it via the bulk edit dialog (no change — current bulk edit already excludes `NO_DEDUCIBLE` from the _destination_ dropdown but accepts any source row)

### Tests

- [ ] Vitest covers the new helper that decides hard vs. soft delete (pure function over `source`)
- [ ] Vitest covers the new helper that finds an overwrite candidate by dedup key (pure function over `{ userId, providerCuit, invoiceNumber, fiscalYear }`)

## Technical Notes

### Where the soft-delete branch lives

In [src/app/api/comprobantes/[id]/route.ts](src/app/api/comprobantes/[id]/route.ts), the existing `DELETE` handler already fetches the row and selects `id` + `fileStorageKey`. Extend the `select` to include `source` + `deductionCategory`, then branch:

- `source === "ARCA"` → `prisma.invoice.update({ where: { id }, data: { deductionCategory: "NO_DEDUCIBLE", familyDependentId: null } })` and return early. Do not touch `AutomationJob` rows or storage.
- else → existing path (delete `AutomationJob`s, delete row, best-effort `deleteFile`).

Keep the `requireWriteAccess` gate in front of both paths.

### Overwrite path on manual upload

The current `processPullComprobantes` dedup uses `invoiceDedupeKey(providerCuit, invoiceNumber, fiscalYear)` (see [src/lib/automation/job-processor.ts:1536-1540](src/lib/automation/job-processor.ts#L1536)). Extract that helper into a shared module (e.g. `src/lib/invoices/dedupe.ts`) so the manual create / PDF upload routes can reuse it. In [src/app/api/comprobantes/route.ts](src/app/api/comprobantes/route.ts) (`POST`) and [src/app/api/comprobantes/upload/route.ts](src/app/api/comprobantes/upload/route.ts), before inserting:

1. Build the dedupe key from the validated input. If `invoiceNumber` is empty, skip the lookup entirely.
2. `prisma.invoice.findFirst({ where: { userId, providerCuit, invoiceNumber, fiscalYear } })`
3. If found, `prisma.invoice.update({ where: { id: found.id }, data: { …submission, source: <new source> } })` and return that row.
4. If not found, fall through to the existing create path.

This means a manual re-upload of a soft-deleted comprobante naturally overwrites it — no separate "restore" endpoint.

### No schema change needed

`NO_DEDUCIBLE` already exists in the `DeductionCategory` enum (`prisma/schema.prisma:214`) and is already wired through the simulador exclusion, SiRADIG mapper guard, and UI badge rendering (see [specs/non-deductible-invoice-category.md](specs/non-deductible-invoice-category.md)). This feature is a pure behavioral change in two API routes plus a small pure helper.

### Audit-job preservation

`AutomationJob`s linked to a soft-deleted invoice via `invoiceId` stay attached — the row still exists. The existing `JobHistoryPanel` will still show the original submission history if the invoice was previously submitted to SiRADIG.

### No SiRADIG cleanup

If the soft-deleted comprobante was already submitted to SiRADIG (`siradiqStatus === "SUBMITTED"`), this spec does not push a delete to SiRADIG — that's a separate concern with its own flow ([specs/optimize-siradig-delete-recreate-flow.md](specs/optimize-siradig-delete-recreate-flow.md)). The category change is local-only.

## Out of Scope

- Soft-delete for recibos (domestic worker receipts) imported from ARCA — out of scope per clarification, recibos continue to hard-delete
- Soft-delete for manual / PDF / OCR / email comprobantes — they continue to hard-delete
- A separate "restore" UI button on soft-deleted rows — recovery is via bulk-edit or manual re-upload
- A new schema field to distinguish "user-deleted NO_DEDUCIBLE" from "AI-classified NO_DEDUCIBLE" — both are treated identically
- Changes to the delete confirmation copy — UX stays as-is
- Pushing a delete to SiRADIG when soft-deleting a previously-submitted comprobante
- Migration of historically-deleted ARCA comprobantes (those rows are gone; users will see them reappear on the next pull and can delete-as-soft-delete from then on)
