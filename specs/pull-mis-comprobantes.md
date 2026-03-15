---
title: Pull "Comprobantes Recibidos" from ARCA's "Mis Comprobantes" into desgrava.ar invoices
status: implemented
priority: high
---

## Summary

An automation that logs into ARCA with the user's credentials, navigates to the "Mis Comprobantes" service, enters "Comprobantes Recibidos", searches for all invoices within the current fiscal year, exports them as a CSV file, parses the CSV, and bulk-imports each invoice into the user's facturas page in desgrava.ar.

This eliminates the need for users to manually enter or upload every invoice they received during the fiscal year. Existing invoices previously imported into desgrava.ar are preserved — duplicates detected during import are skipped, keeping the user's original data (including any manual edits or category corrections) intact.

After import, each new invoice is classified using the existing AI category classifier to automatically assign a deduction category.

## Acceptance Criteria

- [ ] A new button ("Importar desde ARCA") is added to the facturas page for the user to trigger the import
- [ ] The automation logs into ARCA using the user's stored encrypted credentials
- [ ] The automation searches for the "Mis Comprobantes" service in the ARCA portal service search and enters it
- [ ] Inside "Mis Comprobantes", the automation navigates to "Comprobantes Recibidos"
- [ ] The automation searches for all comprobantes in the selected fiscal year (full year range: January 1 through December 31)
- [ ] The automation exports the search results as a CSV file and downloads it
- [ ] The CSV file is parsed and each row is mapped to invoice fields (providerCuit, providerName, invoiceType, invoiceNumber, invoiceDate, amount, fiscalMonth)
- [ ] Before creating each invoice, a duplicate check is performed: if an invoice with the same providerCuit + invoiceNumber + invoiceDate already exists for the user in that fiscal year, the existing record is kept unchanged (no overwrite)
- [ ] New invoices are created with `source: "ARCA"` to distinguish them from manually entered or PDF-uploaded invoices
- [ ] Each new invoice is classified using the existing AI category classifier (`category-classifier.ts`) to auto-assign a deduction category
- [ ] The import progress is visible to the user in real time (total found, imported, skipped as duplicates, classified)
- [ ] If the user navigates away and returns, they should see the import still in progress or the final results if it completed
- [ ] A summary is shown at the end: total comprobantes found, newly imported, skipped (duplicates), and any errors
- [ ] The process is async and respects the existing job queue (max 1 concurrent automation job)

## Technical Notes

### New enum values

- Add `ARCA` to the `InvoiceSource` enum in `schema.prisma` (requires a migration)
- Add `PULL_COMPROBANTES` to the `JobType` enum in `schema.prisma` (requires a migration)

### Automation flow

1. **Login**: Reuse existing ARCA login flow from `arca-navigator.ts` (uses `domcontentloaded` + element waits)
2. **Service search**: In the ARCA portal, locate the service search input, type "Mis Comprobantes", and click the matching result
3. **Navigate to Comprobantes Recibidos**: Once inside the service, click on the "Comprobantes Recibidos" section/tab
4. **Search**: Set the date range to cover the full fiscal year and trigger the search
5. **Export CSV**: Click the CSV export button and wait for the file download
6. **Parse CSV**: Read the downloaded CSV, map columns to invoice fields. The CSV from "Mis Comprobantes" typically includes: Fecha, Tipo, Punto de Venta, Número Desde, CUIT Emisor, Denominación Emisor, Imp. Total, Moneda, etc.
7. **Bulk import**: For each parsed row, check for duplicates, classify via AI, and create the invoice record

### Duplicate detection

Match on the combination of `userId` + `providerCuit` + `invoiceNumber` + `fiscalYear`. If a match is found, skip the row entirely — do not update or overwrite the existing record.

### AI classification

Use the existing `classifyCategory()` function from `src/lib/ocr/category-classifier.ts`. Construct an input string from the CSV row data (provider name, description, amount) and pass it to the classifier. If classification fails or returns low confidence, default to `OTRAS_DEDUCCIONES`.

### Job processor integration

Add a new case in `job-processor.ts` for `PULL_COMPROBANTES`. The job payload should include the `fiscalYear`. Store import results (counts of imported, skipped, errored) in the job's `result` JSON field.

### Important: Use `/arca-assisted-navigation` for implementation

Since "Mis Comprobantes" is a separate ARCA service (not SiRADIG), the page structure, selectors, and navigation flow are unknown. **Do not guess selectors.** Use the `/arca-assisted-navigation` skill to record a live browsing session and generate the Playwright automation code.

## Out of Scope

- Exporting or pushing invoices from desgrava.ar back to ARCA/Mis Comprobantes
- Importing "Comprobantes Emitidos" (only "Comprobantes Recibidos" is in scope)
- Importing invoices from fiscal years other than the one selected by the user
- Attaching the original PDF/file for each imported comprobante (only structured data from CSV is imported)
- Editing or merging data from ARCA into existing invoices that were previously imported manually
