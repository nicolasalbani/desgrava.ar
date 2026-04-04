---
title: Optimize SiRADIG Deduction Submission with Delete-Recreate Flow
status: implemented
priority: high
---

## Summary

When submitting a deduction to SiRADIG that already exists, the automation currently has a fragile two-pass approach: try to create → detect duplicate error → attempt category-specific edit (only 4 of 16 categories have edit handlers, the rest fail). This spec replaces the entire flow with a universal delete+recreate strategy: before submitting, check if the deduction already exists → delete it if it does → create a fresh one. This eliminates category-specific edit handlers, ensures all 16 categories work consistently, and fixes the GASTOS_INDUMENTARIA_TRABAJO category which currently hardcodes the concept as "Equipamiento" instead of allowing other concepts like connectivity.

## Acceptance Criteria

- [ ] Before creating a new deduction, `fillDeductionForm` checks the existing deductions table for a matching entry (same category + CUIT + period)
- [ ] If a matching entry is found, the system deletes it from the SiRADIG table before proceeding with creation (using the row's delete/eliminar action button)
- [ ] After deletion, the system creates a fresh deduction entry using the standard create flow — no category-specific edit handlers needed
- [ ] The delete+recreate flow works for ALL 16 user-facing deduction categories, including those that previously failed on duplicate (DONACIONES, INTERESES_HIPOTECARIOS, GASTOS_SEPELIO, APORTE_SGR, VEHICULOS_CORREDORES, INTERESES_CORREDORES, OTRAS_DEDUCCIONES, CUOTAS_MEDICO_ASISTENCIALES, PRIMAS_SEGURO_MUERTE, PRIMAS_AHORRO_SEGUROS_MIXTOS, APORTES_RETIRO_PRIVADO)
- [ ] The delete+recreate flow also works for SUBMIT_DOMESTIC_DEDUCTION (domestic worker deductions matched by CUIL)
- [ ] The `window.confirm()` dialog triggered by SiRADIG's delete button is auto-accepted via override (same pattern used in existing comprobante deletion)
- [ ] After deleting an existing entry, the system waits for the table to update before opening the "Agregar" dropdown for recreation
- [ ] The GASTOS_INDUMENTARIA_TRABAJO category correctly selects the appropriate `#idConcepto` value based on the invoice, instead of always hardcoding "Equipamiento" (value "2"). Internet/connectivity expenses must map to the correct concept option
- [ ] Job logs clearly indicate when a delete+recreate was performed (e.g., "Deducción existente encontrada — eliminando y recreando...")
- [ ] If deletion fails (e.g., entry is locked/confirmed), the job fails with a descriptive error
- [ ] The old category-specific edit handlers (`editStandardDeductionEntry`, `editAlquilerEntry`, `findAndEditExisting`) and the duplicate-retry flow in `job-processor.ts` are removed
- [ ] All existing automation tests pass, and new tests cover the delete+recreate logic and `#idConcepto` concept selection

## Technical Notes

### Delete button discovery

The SiRADIG deduction table rows have action buttons (`.act_editar` for edit is already known). The delete button selector needs to be discovered via `/arca-assisted-navigation` — likely `.act_eliminar` or similar, within `#div_tabla_deducciones_agrupadas fieldset tbody tr`. SiRADIG shows a `window.confirm()` dialog on delete — override it with the same pattern used in `editAlquilerEntry` (set `window.confirm = () => true` before clicking, restore after).

### Simplified flow in `fillDeductionForm`

Replace the current check-then-edit logic (lines 631–675 of `siradig-navigator.ts`) with check-then-delete:

```
1. Search #div_tabla_deducciones_agrupadas for matching entry (category + CUIT + period)
2. If found → click delete button on the row → auto-accept confirm → wait for table update
3. Proceed with normal create flow (open dropdown → select category → fill form)
```

This means the function always ends with a fresh form, regardless of whether an entry existed before.

### Domestic deductions (`fillDomesticDeductionForm`)

Apply the same pattern: replace the current check-then-edit-in-place logic (lines 2617–2695 of `siradig-navigator.ts`) with check-then-delete-then-create. Match by CUIL in the "Deducción del Personal Doméstico" fieldset, delete if found, then create fresh.

### GASTOS_INDUMENTARIA_TRABAJO concept selection

The current code (line 761) hardcodes `page.selectOption("#idConcepto", "2")` ("Equipamiento"). The `#idConcepto` dropdown has multiple options — use `/arca-assisted-navigation` to discover all available values (likely includes "Indumentaria", "Equipamiento", "Conectividad" or similar). Add a field or mapping so invoices can specify which concept they represent, and select accordingly.

### Code to remove

- `findAndEditExisting()` and all its category-specific handlers (`editStandardDeductionEntry`, `editAlquilerEntry`) in `siradig-navigator.ts` (~650 lines, 1807–2458)
- The duplicate-retry block in `job-processor.ts` (lines 3258–3305) — no longer needed since we delete before creating
- `isDuplicateError()` helper and `DUPLICATE_PATTERNS` constant
- `siradigEdit` selectors in `selectors.ts` that are only used by edit handlers (keep `deleteRowButton` if reusable for the new delete flow)

### Job processor simplification

The SUBMIT_INVOICE flow in `processJob()` becomes:

```
fillDeductionForm (handles delete-if-exists internally) → submitDeduction → done
```

No duplicate detection, no retry, no `findAndEditExisting` fallback.

### Selectors to add

Add to `ARCA_SELECTORS` in `selectors.ts`:

- `siradig.deductionDeleteButton` — the delete action button on deduction table rows (discover via `/arca-assisted-navigation`)

### Testing

- Unit tests for the delete flow logic (mocking page interactions)
- Test that all 16 categories go through the same delete+recreate path
- Test the `#idConcepto` mapping for GASTOS_INDUMENTARIA_TRABAJO with different concept types
- Integration validation: run a SUBMIT_INVOICE job for a category that previously failed on duplicate

## Out of Scope

- Adding new deduction categories (e.g., a dedicated internet/connectivity category)
- Bulk comparison/sync between desgrava.ar invoices and existing SiRADIG entries
- Deleting deductions without recreating them (user-initiated delete from desgrava.ar)
- Changes to PUSH_FAMILY_DEPENDENTS or PUSH_EMPLOYERS flows (these already have working check-then-edit and are not deduction table entries)
- Changes to presentacion submission flow
