---
title: Update existing deduction in SiRADIG instead of failing on duplicate
status: partial
priority: high
---

## Summary

When desgrava.ar submits a factura to SiRADIG and the comprobante already exists (same CUIT + invoice number + period), the automation currently fails with a validation error. Instead, the system should detect the duplicate, find the existing entry in SiRADIG, update it with the new values, and mark the submission as successful.

This is critical because users frequently need to correct amounts, categories, or other details on previously submitted deductions. The current failure forces them to log into SiRADIG manually to fix entries, defeating the purpose of the automation.

## Acceptance Criteria

- [ ] When `submitDeduction` fails with an error indicating a duplicate comprobante, the automation retries by finding and editing the existing entry instead of marking the job as FAILED
- [ ] The existing entry is located in SiRADIG's deduction list by matching the provider CUIT and comprobante number within the same category section
- [ ] The existing entry's fields (amount, invoice date, invoice type, period) are updated with the values from desgrava.ar
- [ ] After a successful update, the invoice's `siradiqStatus` is set to `SUBMITTED` (same as a fresh submission)
- [ ] The job logs clearly indicate that an update was performed instead of a new submission (e.g., "Comprobante ya existe en SiRADIG — actualizando...")
- [ ] If the existing entry cannot be found or edited (e.g., it was already confirmed/locked by SiRADIG), the job fails with a descriptive error message
- [ ] The user sees a clear distinction in the job detail between "created" and "updated" submissions
- [ ] This works for both individual invoice submissions and bulk submissions

## Technical Notes

### Duplicate detection

SiRADIG shows validation errors when saving a comprobante that already exists. The error message typically appears in `.formErrorContent` and may contain text like "ya fue informado" or "comprobante existente" or "datos duplicados". Detect these patterns in `submitDeduction` and trigger the update flow instead of returning failure.

### Update flow

After detecting a duplicate:

1. **Cancel the current form** — click "Volver" or dismiss the error to return to the deduction list view (`#div_listado`)
2. **Find the existing entry** — SiRADIG shows a table of existing deductions for the current category. Search the table rows for the matching provider CUIT and comprobante number
3. **Click edit** — each row has an edit button (pencil icon). Click it to open the edit form
4. **Update fields** — reuse the existing `fillDeductionForm` logic to fill/overwrite the fields
5. **Save** — submit the updated form via the same `submitDeduction` flow. If this second save also fails, then return the error as a genuine failure

### Per-category edit flows

Each deduction category has its own form layout and fields in SiRADIG, just as the create flow already has category-specific handlers (`fillAlquilerLocatarioForm`, `fillEducacionForm`, etc.). The edit flow must follow the same pattern — each category needs its own edit handler because:

- **Different table columns**: the deduction list table shows different columns per category (e.g., "Alquiler" shows contract dates and monthly rows, "Gastos médicos" shows a single comprobante row with CUIT + amount)
- **Different matching criteria**: "Alquiler" entries are matched by month within a contract, not by comprobante number. "Servicio doméstico" entries are matched by period. Standard deductions match by CUIT + comprobante number.
- **Different edit form behavior**: editing an "Alquiler" entry re-opens the monthly detail row, while editing a standard deduction re-opens the comprobante dialog. Some categories may pre-fill fields differently in edit mode vs create mode.
- **Different editable fields**: some categories have fields that are only set at creation time and become read-only when editing (e.g., contract dates on "Alquiler")

Implement an `editDeductionForm` function (or per-category variants like `editAlquilerForm`, `editEducacionForm`) following the same dispatch pattern used by `fillDeductionForm`. Each variant should be recorded via `/arca-assisted-navigation` since the edit UI may differ from the create UI.

### Important: Use `/arca-assisted-navigation` for implementation

SiRADIG's deduction list table structure, edit button selectors, and form behavior when editing (vs creating) are not fully known. **Do not guess selectors.** Use the `/arca-assisted-navigation` skill to record a live session where you:

1. Navigate to a deduction category that has existing entries
2. Observe the list table structure (column layout, row selectors)
3. Click the edit button on an existing entry
4. Observe how the form differs in edit mode vs create mode
5. Save the edited entry

### Job processor integration

In `job-processor.ts`, the SUBMIT_INVOICE flow currently does:

```
fillDeductionForm → submitDeduction → if fail → FAILED
```

Change to:

```
fillDeductionForm → submitDeduction → if duplicate error → findAndEditExisting → submitDeduction → if fail → FAILED
```

The retry should only trigger for duplicate-specific errors, not for other validation failures (missing fields, invalid amounts, etc.).

### siradiqStatus

No new status is needed. Both fresh submissions and updates result in `SUBMITTED`. The distinction is visible in the job logs.

## Out of Scope

- Deleting entries from SiRADIG
- Detecting and resolving conflicts where SiRADIG has different data that was entered manually by the user outside of desgrava.ar
- Updating entries that have already been confirmed/presented to the employer (SiRADIG locks these)
- Bulk comparison/sync between desgrava.ar invoices and existing SiRADIG entries
