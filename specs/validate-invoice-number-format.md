---
title: Validate Invoice Number Format by Comprobante Type
status: implemented
priority: medium
---

## Summary

The "Numero de comprobante" field in the invoice form currently only validates that the value is non-empty, so users can save invoices with malformed numbers (e.g. `1-12345` instead of `00001-00012345`) that ARCA/SiRADIG will later reject during automated submission — causing avoidable job failures. This feature validates the invoice number against the standard format for the selected "Tipo de comprobante" and surfaces the expected format as a tooltip next to the field, so users get immediate, format-specific feedback at entry time instead of discovering the mistake during automation.

## Acceptance Criteria

### Validation — Format Rules per Type

- [ ] Define a `getInvoiceNumberFormat(invoiceType)` helper in `src/lib/validators/invoice.ts` that returns an object describing the expected format for each of the 15 `INVOICE_TYPES`: `{ regex: RegExp, description: string, example: string }`
- [ ] Types using the standard punto de venta + número format (`/^\d{5}-\d{8}$/`, e.g. `00001-00012345`): `FACTURA_B`, `FACTURA_C`, `NOTA_DEBITO_B`, `NOTA_DEBITO_C`, `NOTA_CREDITO_B`, `NOTA_CREDITO_C`, `RECIBO_B`, `RECIBO_C`, `NOTA_VENTA_B`, `NOTA_VENTA_C`, `OTRO_COMPROBANTE_B`, `OTRO_COMPROBANTE_C`, `TIQUE_FACTURA_B`
- [ ] Types using a free-form identifier (non-empty, trimmed): `DOCUMENTO_ADUANERO`, `OTROS_EXCEPTUADOS`
- [ ] Add Vitest coverage in `src/lib/validators/__tests__/invoice.test.ts` (or extend the existing file) for the format helper: each of the 15 types returns the expected regex/description/example; valid and invalid samples are asserted

### Validator Schema

- [ ] Update `createInvoiceSchema` and `updateInvoiceSchema` in `src/lib/validators/invoice.ts` to cross-validate `invoiceNumber` against `invoiceType` using the format helper. When `invoiceNumber` is provided, it must match the regex for the given `invoiceType`; otherwise raise a Zod error keyed to `invoiceNumber` with a message like `Formato inválido. Ejemplo: 00001-00012345`
- [ ] The server-side API (`POST /api/facturas`, `PUT /api/facturas/[id]`) rejects invalid numbers with a 400, leveraging the existing schema validation path — no new handler logic required beyond the schema change

### UI — Invoice Form (`src/components/facturas/invoice-form.tsx`)

- [ ] The client-side `formSchema` applies the same format rule via a `superRefine` (or equivalent) so the user sees the error inline before submit, matching the error message from the shared validator
- [ ] Submission is blocked when the number doesn't match the type's format (consistent with other required-field errors; no override)
- [ ] A help icon (`lucide-react` `HelpCircle` or `Info`, `h-3.5 w-3.5 text-muted-foreground`) sits next to the "Numero de comprobante" label. Hovering/tapping it shows a shadcn `Tooltip` with the description and example for the currently selected `invoiceType` (e.g. `Formato: XXXXX-XXXXXXXX · Ejemplo: 00001-00012345`)
- [ ] When no `invoiceType` is selected yet, the tooltip shows a generic hint: `Seleccioná primero un tipo de comprobante`
- [ ] The input `placeholder` is driven by the selected type's example (replacing the hardcoded `00001-00012345`), so users see a type-appropriate example even without hovering
- [ ] All new UI works on screens as narrow as 320px: the help icon stays on the same line as the label, and the tooltip uses shadcn's default `side` behavior (which flips on mobile). Touch targets for the icon are at least 44×44px via a wrapping button with padding

### Tests

- [ ] Unit tests for the format helper (15 types × valid/invalid cases)
- [ ] Unit tests for the updated `createInvoiceSchema` covering (a) valid number + matching type, (b) invalid number + type mismatch, (c) empty number (still optional at DB level per current schema), (d) free-form types accepting any non-empty string
- [ ] Existing invoice validator tests continue to pass

## Technical Notes

- **Source of truth**: the format rules and descriptions live in `src/lib/validators/invoice.ts` alongside `INVOICE_TYPES` / `INVOICE_TYPE_LABELS`, keeping all comprobante-type metadata in one place. The form component imports the helper rather than duplicating regexes.
- **Shared validator**: the client `formSchema` in `invoice-form.tsx` currently duplicates the server shape. Keep that pattern but have both sides import `getInvoiceNumberFormat` so the regex and error text never drift.
- **No mutation on blur**: per product decision, we validate but do not auto-pad or auto-insert the dash. Users fix the number themselves; the example in the tooltip and placeholder guides them.
- **Rationale for the two free-form types**: SiRADIG renders `DOCUMENTO_ADUANERO` and `OTROS_EXCEPTUADOS` with `#cmpNumeroAlternativo` (a single "Número identificador" field) instead of the punto de venta + número pair — see `src/lib/automation/siradig-navigator.ts:1002-1023`. A strict regex would block legitimate customs/exempt document identifiers.
- **Tooltip component**: use `@/components/ui/tooltip` (already present). Wrap the icon in a `button type="button"` so keyboard/touch users can trigger it.
- **OCR is out of scope**: `src/lib/ocr/field-extractor.ts` continues to emit whatever it extracts. Malformed OCR numbers will now surface as form errors in the review dialog, which is the desired UX — the user edits the field before saving.
- **No DB/migration changes**: `Invoice.invoiceNumber` stays `String?`. This is purely a validation + UX improvement.

## Out of Scope

- Auto-formatting or auto-padding the invoice number as the user types or on blur.
- Changes to OCR extraction logic or auto-correction of OCR-extracted numbers.
- Format validation for any fields other than `invoiceNumber` (e.g., we do not re-validate `providerCuit` format here).
- Retroactive validation / cleanup of existing invoices with malformed numbers already stored in the database.
- Recibos (salary receipts) — this spec covers only the facturas invoice form. Recibos follow a separate flow and data model.
- Changes to the SiRADIG automation code in `siradig-navigator.ts`. The automation's current split on `-` continues to work; the new validation just ensures fewer malformed inputs reach it.
