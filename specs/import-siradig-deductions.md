---
title: Import Existing Deductions from SiRADIG
status: implemented
priority: high
---

## Summary

When users import data from ARCA, the system should also navigate SiRADIG's "Deducciones y desgravaciones" section within "Carga de Formulario" and extract all existing deduction entries. Each row is opened in edit mode to capture full comprobante details (invoice number, date, type, amounts). Extracted entries are upserted into desgrava.ar as Invoice or DomesticReceipt records with `siradiqStatus: SUBMITTED`, overwriting any existing local records that match. This ensures desgrava.ar accurately reflects what's already been submitted to SiRADIG, preventing duplicate submissions and giving users a complete picture of their deductions.

## Acceptance Criteria

- [ ] When the existing PULL_COMPROBANTES job runs (facturas import), it also navigates SiRADIG to extract deductions that map to Invoice records
- [ ] When the existing PULL_DOMESTIC_RECEIPTS job runs, it also navigates SiRADIG to extract entries from the "Deducción del personal doméstico" category into DomesticReceipt records
- [ ] The automation clicks the edit button on each deduction row to extract full comprobante details: CUIT, denominación, período, importe, invoice number (punto de venta + número), invoice date, invoice type, and monto facturado
- [ ] Extracted Invoice records are created with `source: ARCA` and `siradiqStatus: SUBMITTED`
- [ ] Extracted DomesticReceipt records are created with `source: ARCA` and `siradiqStatus: SUBMITTED`
- [ ] If a matching record already exists in desgrava.ar (same CUIT + period + fiscal year), the SiRADIG version overwrites it — amounts, dates, and comprobante details are updated
- [ ] The following deduction categories are supported for Invoice extraction: `GASTOS_MEDICOS`, `PRIMAS_SEGURO_MUERTE`, `GASTOS_INDUMENTARIA_TRABAJO`, `ALQUILER_VIVIENDA`, `GASTOS_EDUCATIVOS`, `CUOTAS_MEDICO_ASISTENCIALES`
- [ ] `SERVICIO_DOMESTICO` entries are extracted as DomesticReceipt records (not Invoice)
- [ ] For `GASTOS_EDUCATIVOS`, the "Familiar" column is used to link the invoice to the matching FamilyDependent if one exists
- [ ] For `ALQUILER_VIVIENDA`, monthly detail rows from `#tabla_meses` are extracted as separate Invoice records per month
- [ ] Step-based progress is shown to the user during extraction (e.g., "Leyendo Gastos Médicos (3/8)...")
- [ ] After closing each edit form, the automation returns to the deduction list before proceeding to the next row
- [ ] If no deductions exist in a category section, that section is skipped silently
- [ ] Unsupported categories (e.g., `DONACIONES`, `APORTES_RETIRO_PRIVADO`) are skipped with a log entry but do not cause job failure

## Technical Notes

### Integration with existing flows

This is NOT a new job type. The extraction logic is added as an additional phase within:

- `processPullComprobantes()` in `job-processor.ts` — after CSV import, navigate to SiRADIG and extract invoice-type deductions
- `processPullDomesticReceipts()` in `job-processor.ts` — after ARCA receipt import, navigate to SiRADIG and extract domestic deductions

Both phases reuse the existing ARCA login session and `navigateToDeductionSection()` from `siradig-navigator.ts`.

### New navigator function

Add `extractSiradigDeductions(page, fiscalYear, categories, onLog, onScreenshot)` to `siradig-navigator.ts`. This function:

1. Calls `navigateToDeductionSection()` to reach "Deducciones y desgravaciones"
2. Iterates over `#div_tabla_deducciones_agrupadas fieldset.grupo_deducciones`
3. For each fieldset, reads the `legend` text and maps it to a `DeductionCategory` using a reverse lookup on `SIRADIG_CATEGORY_MAP` from `deduction-mapper.ts`
4. If the category is in the requested `categories` array, iterates rows via `tbody tr[data-id-reg]`
5. Clicks `div.act_editar` on each row to open the edit form
6. Extracts fields from the edit form (reuse selector patterns from `siradigEdit` in `selectors.ts`):
   - `#numeroDoc` → providerCuit
   - `#razonSocial` → providerName
   - `#mesDesde` / `#mesHasta` → period
   - `#montoTotal` → amount
   - `#tabla_comprobantes tbody tr` → comprobante details (date, type, punto de venta, número, monto)
7. Clicks "Volver" to return to the list view before processing the next row

### Category-specific extraction

- **Standard categories** (Gastos Médicos, Primas de Seguro, Indumentaria, Cuotas Médico-Asistenciales): Extract from edit form + comprobantes sub-table. Each comprobante row becomes one Invoice record.
- **ALQUILER_VIVIENDA**: Extract from `#tabla_meses` (monthly detail rows). Each month row becomes one Invoice record with the monthly amount. Contract dates are extracted from the main form.
- **GASTOS_EDUCATIVOS**: Same as standard, but also extract the "Familiar" field and attempt to match it to a `FamilyDependent` by name.
- **SERVICIO_DOMESTICO**: Extract CUIL, name, period range, and payment details. Map to DomesticReceipt model fields. Match to existing `DomesticWorker` by CUIL.

### Upsert logic

For Invoice records, match on `userId` + `providerCuit` + `fiscalYear` + `fiscalMonth` + `deductionCategory`. If found, update amount, invoice details, and set `siradiqStatus: SUBMITTED`. If not found, create with `source: ARCA`, `siradiqStatus: SUBMITTED`.

For DomesticReceipt records, match on `userId` + `domesticWorkerId` + `fiscalYear` + `fiscalMonth`. Same upsert behavior.

Use Prisma `upsert` for atomic create-or-update operations.

### Selectors

The existing `ARCA_SELECTORS.siradigEdit` already defines most needed selectors (`editCuit`, `editDenominacion`, `editPeriodo`, `editMontoTotal`, `comprobantesTable`, etc.). Add any missing selectors discovered during implementation via `/arca-assisted-navigation`.

### Important: Use `/arca-assisted-navigation` for implementation

While the edit form structure is partially known from the update-existing-siradig-deduction feature, the **read-only extraction** flow (opening edit, reading fields without modifying, closing) has not been recorded. Use `/arca-assisted-navigation` to observe:

1. Opening an edit form for each supported category
2. The exact fields and their selectors in edit mode
3. How to close/cancel the edit form without saving changes
4. Any category-specific differences in the edit form layout

### Job steps

Add new steps to `JOB_TYPE_STEPS` in `job-steps.ts` for the SiRADIG extraction phase (e.g., `READING_SIRADIG_DEDUCTIONS`, `EXTRACTING_CATEGORY`). These appear after the existing import steps in the step-based progress UI.

## Out of Scope

- Extracting deductions from categories not listed above (DONACIONES, APORTES_RETIRO_PRIVADO, INTERESES_HIPOTECARIOS, GASTOS_SEPELIO, APORTE_SGR, VEHICULOS_CORREDORES, INTERESES_CORREDORES, OTRAS_DEDUCCIONES)
- Deleting deductions from SiRADIG
- Detecting discrepancies between SiRADIG and desgrava.ar and prompting the user to resolve them
- Extracting deductions from locked/confirmed presentaciones
- Creating a separate "Importar desde SiRADIG" button — this runs as part of existing import flows
- Importing from fiscal years other than the one selected for the import job
