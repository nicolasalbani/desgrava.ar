---
title: Non-deductible invoice category for ARCA imports
status: implemented
priority: high
---

## Summary

When importing invoices from ARCA, many belong to providers whose services are not tax-deductible (supermarkets, utilities, etc.). Currently, these get classified as "Otras deducciones" by default, which is incorrect — they aren't deductible at all. This feature adds a system-internal `NO_DEDUCIBLE` category that is automatically assigned when no deduction category can be determined. This category is never user-selectable, is excluded from tax calculations, and blocks SiRADIG submission. The `ProviderCatalog` can also store `NO_DEDUCIBLE` to remember that a provider's invoices are non-deductible, benefiting all users on future imports.

## Acceptance Criteria

### Data model

- [ ] A new `NO_DEDUCIBLE` value is added to the `DeductionCategory` enum in the Prisma schema
- [ ] A Prisma migration is created for the new enum value
- [ ] No existing data is migrated — the change applies to new imports only

### ARCA import behavior

- [ ] During `processPullComprobantes`, invoices whose provider CUIT has no `ProviderCatalog` match and whose AI classification fails or returns no confident result are assigned `NO_DEDUCIBLE` instead of `OTRAS_DEDUCCIONES`
- [ ] The `ProviderCatalog` stores `NO_DEDUCIBLE` for these CUITs so future imports skip AI classification entirely

### AI classifier changes

- [ ] The AI classifier (`classifyCategory` in `category-classifier.ts`) returns `NO_DEDUCIBLE` as its fallback instead of `OTRAS_DEDUCCIONES` when it cannot confidently classify an invoice
- [ ] The `resolveCategory` function in `provider-catalog.ts` uses `NO_DEDUCIBLE` as its fallback when all classification strategies fail

### UI restrictions

- [ ] `NO_DEDUCIBLE` does not appear in the category dropdown in the manual invoice form (`invoice-form.tsx`)
- [ ] `NO_DEDUCIBLE` does not appear in the category dropdown in the PDF upload flow
- [ ] `NO_DEDUCIBLE` does not appear in the bulk edit category dialog
- [ ] `NO_DEDUCIBLE` does not appear in the category filter popover options
- [ ] Invoices with `NO_DEDUCIBLE` display a distinct visual indicator in the invoice list (e.g., a muted "No deducible" badge) so users can identify them and re-categorize if needed via bulk edit

### SiRADIG submission blocking

- [ ] Invoices with category `NO_DEDUCIBLE` cannot be submitted to SiRADIG — the "Enviar a SiRADIG" action is disabled/hidden for these invoices
- [ ] `NO_DEDUCIBLE` invoices are excluded from bulk SiRADIG submission (BULK_SUBMIT jobs)
- [ ] The `deduction-mapper.ts` does not include a SiRADIG mapping for `NO_DEDUCIBLE`

### Simulador exclusion

- [ ] Invoices with `NO_DEDUCIBLE` are excluded from tax savings calculations in the simulador
- [ ] The simulador summary does not count `NO_DEDUCIBLE` invoices in deduction totals

### Validators

- [ ] The invoice creation Zod schema (`invoice.ts`) excludes `NO_DEDUCIBLE` from the allowed categories for manual creation (API-level enforcement, not just UI)
- [ ] The `DEDUCTION_CATEGORIES` array used for user-facing dropdowns excludes `NO_DEDUCIBLE`
- [ ] A separate constant (e.g., `ALL_DEDUCTION_CATEGORIES`) includes `NO_DEDUCIBLE` for internal use (DB queries, type checking)

## Technical Notes

### Enum addition

Add `NO_DEDUCIBLE` to the `DeductionCategory` enum in `prisma/schema.prisma`. Run `npx prisma migrate dev --name add-no-deducible-category` to create the migration.

### Category constants split

In `src/lib/validators/invoice.ts`, the `DEDUCTION_CATEGORIES` array currently lists all categories for the UI. Split into:

- `DEDUCTION_CATEGORIES` — user-selectable categories (excludes `NO_DEDUCIBLE`), used by form dropdowns and the manual creation Zod schema
- `ALL_DEDUCTION_CATEGORIES` — all categories including `NO_DEDUCIBLE`, used for DB validation, type guards, and internal logic

### Classifier fallback change

In `src/lib/ocr/category-classifier.ts`, change the fallback return from `"OTRAS_DEDUCCIONES"` to `"NO_DEDUCIBLE"`. Update the OpenAI system prompt to include `NO_DEDUCIBLE` as an option with the description: "invoices from providers whose services are not tax-deductible (e.g., supermarkets, general retail, utilities not related to deductible categories)".

### ProviderCatalog integration

`resolveCategory()` in `src/lib/catalog/provider-catalog.ts` already writes to the catalog after classification. When the result is `NO_DEDUCIBLE`, it should still be written — this prevents repeated AI calls for the same non-deductible provider.

### SiRADIG mapper

`src/lib/automation/deduction-mapper.ts` maps categories to SiRADIG form selectors. Do not add a mapping for `NO_DEDUCIBLE`. Add a guard in the submission flow that skips/rejects `NO_DEDUCIBLE` invoices before reaching the mapper.

### Invoice list display

In `src/components/facturas/`, invoices with `NO_DEDUCIBLE` should show a muted badge (e.g., gray "No deducible" text or badge). Users can still select these invoices and use bulk edit to assign a real category — but `NO_DEDUCIBLE` itself won't appear in the bulk edit dropdown.

## Out of Scope

- Migrating existing `OTRAS_DEDUCCIONES` invoices from ARCA to `NO_DEDUCIBLE`
- Admin UI to manually set providers as non-deductible in the catalog
- Auto-detection of non-deductible providers via external data sources
- Separate "non-deductible" filter/view page
- Changes to domestic worker receipts (recibos) — only affects facturas
