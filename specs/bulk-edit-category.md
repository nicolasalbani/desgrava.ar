---
title: Bulk edit deduction category for selected invoices
status: implemented
priority: medium
---

## Summary

Allow users to change the deduction category of multiple selected invoices at once. The base workflow is: search for a provider in the facturas list, select all matching invoices via the existing checkboxes, and apply a new category in a single action. This is essential after an ARCA import where hundreds of invoices arrive with AI-guessed categories — the user needs a fast way to correct misclassifications for an entire provider.

When a bulk category change is applied, the global `ProviderCatalog` should also be updated so future invoices from that provider get the corrected category by default.

## Acceptance Criteria

- [ ] A "Cambiar categoría" button appears in the existing selection action bar when one or more invoices are selected
- [ ] Clicking the button opens a dialog/popover with a dropdown of all deduction categories
- [ ] After selecting a category and confirming, all selected invoices are updated in a single batch operation
- [ ] The table reflects the updated categories immediately without a full page reload
- [ ] A success toast shows how many invoices were updated (e.g. "12 comprobantes actualizados a Gastos médicos")
- [ ] If all selected invoices share the same provider CUIT, the `ProviderCatalog` entry for that CUIT is also updated to the new category (so future imports use the corrected category)
- [ ] If selected invoices span multiple providers, only invoice records are updated — the catalog is not touched (ambiguous which provider to update)
- [ ] The existing search/filter flow works naturally: user types a provider name or CUIT in the search bar, the list filters, user clicks "select all", then "Cambiar categoría"

## Technical Notes

### API endpoint

Add a new `PATCH /api/facturas/bulk-category` endpoint that accepts:

```json
{
  "invoiceIds": ["id1", "id2", ...],
  "deductionCategory": "GASTOS_MEDICOS"
}
```

The endpoint should:

1. Validate the category is a valid `DeductionCategory` enum value
2. Verify all invoice IDs belong to the authenticated user
3. Update all invoices in a single `prisma.invoice.updateMany`
4. If all invoices share the same `providerCuit`, upsert the `ProviderCatalog` entry with `source: MANUAL`
5. Return the count of updated records

### UI integration

The "Cambiar categoría" button should appear alongside the existing "Enviar a SiRADIG" and "Eliminar" buttons in the selection action bar. Use a `Popover` with a category `Select` dropdown and a confirm button — similar pattern to the existing category filter popover.

### ProviderCatalog update

When updating the catalog, use `source: MANUAL` since this is an explicit user correction. Unlike automated entries, `MANUAL` entries should take precedence — update even if an entry already exists (the user knows better than the AI).

## Out of Scope

- Bulk editing other invoice fields (amount, date, provider, etc.)
- Undo/revert functionality for bulk changes
- Bulk category change from the automation dashboard or any page other than the facturas list
