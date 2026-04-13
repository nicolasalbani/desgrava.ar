---
title: Align Comprobante Types with SiRADIG
status: implemented
priority: high
---

## Summary

The app's comprobante (invoice) type list doesn't match what SiRADIG actually accepts. SiRADIG offers 15 specific types across all deduction categories (verified via live browser inspection), while the app offers 11 types that include invalid options (type A comprobantes) and miss several valid ones (Recibo B/C, Nota de Venta, Tique-factura, etc.). This causes automation failures when submitting invoices — either the type isn't available in SiRADIG's dropdown, or the wrong type is selected. The fix aligns the app's type list to exactly match SiRADIG's.

## Acceptance Criteria

### Data Model

- [ ] Add new `InvoiceType` enum values to Prisma schema: `RECIBO_B`, `RECIBO_C`, `NOTA_VENTA_B`, `NOTA_VENTA_C`, `DOCUMENTO_ADUANERO`, `OTRO_COMPROBANTE_B`, `OTRO_COMPROBANTE_C`, `TIQUE_FACTURA_B`, `OTROS_EXCEPTUADOS`
- [ ] Remove `FACTURA_A`, `NOTA_DEBITO_A`, `NOTA_CREDITO_A` from the enum (these don't exist in SiRADIG)
- [ ] Remove `RECIBO` and `TICKET` from the enum (replaced by B/C-specific variants)
- [ ] Create a database migration that converts existing data: `FACTURA_A` → `FACTURA_B`, `NOTA_DEBITO_A` → `NOTA_DEBITO_B`, `NOTA_CREDITO_A` → `NOTA_CREDITO_B`, `RECIBO` → `RECIBO_B`, `TICKET` → `TIQUE_FACTURA_B`

### Validators & Constants

- [ ] Update `INVOICE_TYPES` array in `src/lib/validators/invoice.ts` to match the 15 SiRADIG types
- [ ] Update `INVOICE_TYPE_LABELS` with Spanish labels matching SiRADIG exactly: "Factura B", "Nota de Débito B", "Nota de Crédito B", "Recibo B", "Nota de Venta al contado B", "Factura C", "Nota de Débito C", "Nota de Crédito C", "Documento Aduanero", "Recibo C", "Nota de Venta al contado C", "Otro comprobante B (RG 1415)", "Otro comprobante C (RG 1415)", "Tique-factura B", "Otros comp. doc. exceptuados"

### Automation — Deduction Mapper

- [ ] Update `SIRADIG_INVOICE_TYPE_MAP` in `src/lib/automation/deduction-mapper.ts` to map all 15 enum values to their exact SiRADIG dropdown text
- [ ] Update `reverseLookupInvoiceType()` to handle the new types for SiRADIG extraction
- [ ] Update `CREDIT_NOTE_TYPES` set — only `NOTA_CREDITO_B` and `NOTA_CREDITO_C` remain

### OCR — Field Extraction

- [ ] Update `extractInvoiceType()` in `src/lib/ocr/field-extractor.ts` to detect and return the new enum values
- [ ] Remove type A detection patterns (Factura A, Nota Débito A, Nota Crédito A)
- [ ] Map previously-detected "RECIBO" → `RECIBO_B` and "TICKET" → `TIQUE_FACTURA_B` as defaults
- [ ] Add detection patterns for new types where feasible (Nota de Venta, Tique-factura)

### UI — Invoice Form

- [ ] The "Tipo de comprobante" dropdown in `src/components/facturas/invoice-form.tsx` shows all 15 valid types with SiRADIG-matching labels
- [ ] All new UI works on screens as narrow as 320px

### Tests

- [ ] Update OCR field-extractor tests for new type mappings
- [ ] Update deduction-mapper tests for new types and reverse lookups
- [ ] Update validator tests for the new `INVOICE_TYPES` array
- [ ] All existing tests that reference removed types are updated

## Technical Notes

- **SiRADIG comprobante types are universal** — the same 15 options appear in every deduction category (Primas de Seguro, Cuotas Médico, Gastos Médicos, Gastos de Educación, etc.). This was verified via live browser inspection on 2026-04-11.
- **No type A comprobantes** — SiRADIG doesn't accept Factura A, Nota de Débito A, or Nota de Crédito A. Type A invoices are for IVA-registered-to-IVA-registered transactions, which don't apply to individual taxpayer deductions.
- **Migration strategy**: Use a Prisma migration with raw SQL to convert existing `FACTURA_A` → `FACTURA_B` etc. before removing the old enum values. This avoids data loss.
- **OCR fallback**: When OCR detects a generic "RECIBO" or "TICKET", default to `RECIBO_B` and `TIQUE_FACTURA_B` respectively — these are the most common variants for individual taxpayers.
- **`SIRADIG_INVOICE_TYPE_MAP` labels must match exactly** — the automation uses `page.selectOption("#cmpTipo", { label: text })` which requires exact text match with SiRADIG's dropdown options.
- **Mobile-first**: The type dropdown is already responsive (`<Select>` component). New options just add more items to the list — no layout changes needed.

## Out of Scope

- **Category-specific comprobante type filtering**: All 15 types are available in all SiRADIG categories, so no per-category filtering is needed.
- **Factura A support**: Type A comprobantes are not valid in SiRADIG for individual deductions. If a user uploads a Factura A, OCR should map it to Factura B.
- **Alquiler (rental) comprobante types**: The rental deduction form uses a completely separate UI flow in SiRADIG — its types should be investigated separately if needed.
- **Donaciones comprobante types**: Donaciones uses a different form structure without a standard comprobante dialog.
