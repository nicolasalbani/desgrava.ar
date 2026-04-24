---
title: Auto-Calculate Month & Editable Provider Name in Carga Manual
status: implemented
priority: medium
---

## Summary

On the manual invoice entry form (Carga manual), the "Mes" field today defaults to the current month and is picked independently of "Fecha del comprobante", so users frequently forget to update it and end up with invoices filed under the wrong fiscal month. The "Nombre del proveedor" field is also `readOnly`, driven only by the `/api/cuit-lookup` response — when the lookup fails or returns empty, users are stuck with a blank field and the form blocks submission (providerName is required), forcing them to abandon manual entry. This feature auto-derives the month from the invoice date (while keeping it editable for edge cases) and makes the provider name editable so users can type it in when the automatic lookup misses.

## Acceptance Criteria

### Month auto-calculation

- [ ] In `src/components/facturas/invoice-form.tsx`, when the user changes "Fecha del comprobante" (`invoiceDate`), the form automatically sets `fiscalMonth` to the month extracted from that date (1–12).
- [ ] The update happens on every `invoiceDate` change — even if the user previously edited `fiscalMonth` manually. Users can still override after the date change (see next criterion).
- [ ] The "Mes" `<Select>` remains fully editable by the user after auto-fill. Manually-picked months persist as long as `invoiceDate` doesn't change again.
- [ ] On initial form render (both new and edit modes), if `defaultValues.fiscalMonth` is present, it is respected and NOT overwritten from `defaultValues.invoiceDate`. Auto-calc only fires on user-driven changes to `invoiceDate`, not on mount.
- [ ] If the user clears `invoiceDate`, `fiscalMonth` is left untouched (no reset to current month).
- [ ] `fiscalYear` is NOT auto-updated from `invoiceDate`. The existing cross-field validation (`invoiceDate` year must equal `fiscalYear`) continues to surface mismatches as a form error on `invoiceDate`.

### Editable provider name

- [ ] The `providerName` input in `invoice-form.tsx` is no longer `readOnly`. Users can type, paste, and edit the value directly.
- [ ] The CUIT lookup behavior (`fetchProviderName` in `invoice-form.tsx:275-299`) continues to fire on CUIT change and populates `providerName` when the lookup returns a `razonSocial`.
- [ ] When the CUIT lookup returns an empty `razonSocial`, the field is left empty (no placeholder-as-value). The existing line that explicitly sets `providerName` to `""` on empty lookup is removed so it doesn't clobber text the user has already typed manually.
- [ ] While `lookingUpName` is `true`, the spinner still renders, and the placeholder shows "Buscando...". When not looking up, the placeholder changes from "Se completa con el CUIT" to "Nombre o razón social del proveedor" to signal the field is editable.
- [ ] Form validation still requires `providerName` to be non-empty (existing `z.string().min(1, ...)`); no change to the Zod schema.
- [ ] All new UI works on screens as narrow as 320px: the provider name input takes full width on mobile under the existing `md:grid-cols-2` responsive grid, and remains at least 44px tall for touch.

### Tests

- [ ] No new `src/lib/` or `src/hooks/` modules are introduced, so no new unit test files are required. Existing test suites (validators, etc.) continue to pass.
- [ ] Manual QA: loading an OCR-extracted invoice with `invoiceDate=2025-07-15` and `fiscalMonth=3` (from `defaultValues`) renders with month=March (respects defaults). Changing the date to `2025-09-20` updates month to September. Manually changing month to October keeps October until date changes again.
- [ ] Manual QA: entering a CUIT whose `/api/cuit-lookup` returns no `razonSocial` leaves the provider name field empty and editable; user can type a name and save successfully.

## Technical Notes

- **Implementation surface**: a single file, `src/components/facturas/invoice-form.tsx`. No API, schema, or validator changes.
- **Month derivation**: parse `invoiceDate` (ISO `YYYY-MM-DD` string from the native date input) via `new Date(invoiceDate + "T00:00:00")` or `parseInt(invoiceDate.split("-")[1])` to avoid timezone drift. Use a `useEffect` that watches `form.watch("invoiceDate")`, with a `useRef` to track the last-seen date so the effect doesn't re-fire on unrelated re-renders or overwrite `fiscalMonth` on mount.
- **Respect initial defaults**: seed the ref with `defaultValues?.invoiceDate ?? ""` so the first render's `invoiceDate` value is treated as already-processed. Subsequent changes trigger the auto-fill.
- **Provider name editability**: remove the `readOnly` prop from the `<Input id="providerName" ... />`, keep the existing `Loader2` overlay, remove the `read-only:bg-muted/30` className, update the placeholder. Leave `fetchProviderName` intact except for dropping the `form.setValue("providerName", "")` branch on empty `razonSocial` to avoid clobbering user input.
- **Race-condition nuance**: if a user pastes a new CUIT and starts typing the name before the lookup resolves, the successful lookup will still overwrite the typed value (this matches today's behavior and is intentional — changing CUIT means a new provider). The `lastLookedUpNameCuit` ref prevents duplicate lookups for the same CUIT.
- **Styling**: follow existing conventions (`missingGlow` amber ring for OCR-missing fields continues to apply to both fields).

## Out of Scope

- Changes to the recibos (salary receipts) form — this spec covers only the facturas manual entry form.
- Changes to the OCR pipeline (`src/lib/ocr/`) or the `fiscalMonth` field extraction logic.
- Changes to the `/api/cuit-lookup` endpoint, the global `ProviderCatalog`, or any caching layer.
- Auto-updating `fiscalYear` from `invoiceDate` (the existing year-must-match validation stays as the user-facing signal).
- Changes to the Zod validator (`src/lib/validators/invoice.ts`) or server-side API routes.
- Any UI on the bulk ARCA import flow (`import-arca-dialog.tsx`) — only the manual `invoice-form.tsx` is in scope.
