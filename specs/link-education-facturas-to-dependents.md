---
title: Link Education Facturas to Family Dependents
status: implemented
priority: high
---

## Summary

Education facturas (`GASTOS_EDUCATIVOS`) need to be linked to specific family dependents (cargas de familia) so the SiRADIG automation selects the correct person when submitting deductions. Currently the automation hardcodes selecting the first family member from SiRADIG's "Carga de Familia" table, which is incorrect when a user has multiple children or dependents.

The linking should happen automatically at import time by matching information on the factura (e.g. student name) against the user's existing cargas de familia for that fiscal year. When submitting to SiRADIG, the automation must use this link instead of the current default.

## Acceptance Criteria

### Database

- [ ] Add an optional `familyDependentId` foreign key on the `Invoice` model pointing to `FamilyDependent`
- [ ] The relationship should be nullable — only education facturas need it, and matching may not always succeed
- [ ] Create a Prisma migration for the schema change

### Auto-linking at Import

- [ ] When an education factura is created or imported (manual entry, OCR upload, or AI classification), attempt to match it to an existing `FamilyDependent` for that user and fiscal year
- [ ] Matching logic should extract person names from the factura data (provider name, description, OCR text) and fuzzy-match against `nombre` + `apellido` of the user's dependents for that fiscal year
- [ ] If exactly one dependent matches, auto-link the factura
- [ ] If multiple dependents match or no match is found, leave `familyDependentId` null (user can link manually)
- [ ] Log the matching result (matched, ambiguous, no match) for debugging

### Manual Linking UI

- [ ] On the factura table or detail view, education facturas should display which dependent they are linked to (or "Sin vincular" if unlinked)
- [ ] Users should be able to manually link or change the linked dependent via a dropdown/select showing their cargas de familia for that fiscal year
- [ ] The dependent selector should only appear for education category facturas

### SiRADIG Automation

- [ ] When submitting an education factura to SiRADIG, use the linked `familyDependentId` to select the correct person in the "Carga de Familia" dialog
- [ ] Match the linked dependent against SiRADIG's table rows by document number (`numeroDoc`) or name (`apellido`, `nombre`)
- [ ] Remove the current hardcoded behavior of selecting the first family member
- [ ] If the factura has no linked dependent, fail the submission with a clear error message instead of guessing
- [ ] Log which dependent was selected in SiRADIG for troubleshooting

### Edge Cases

- [ ] If the linked dependent no longer exists in `FamilyDependent` (deleted), treat as unlinked
- [ ] If the linked dependent is not found in SiRADIG's table at submission time, fail with a descriptive error
- [ ] Updating a factura's category to/from `GASTOS_EDUCATIVOS` should trigger or clear the auto-link attempt

## Technical Notes

### Name Matching Strategy

The auto-matching should use normalized string comparison (lowercase, no accents, trimmed) and check if dependent name tokens appear in the factura's description or provider fields. For example, a factura with description "Cuota mensual - LUCA ALBANI" should match a dependent with `nombre: "LUCA"`, `apellido: "ALBANI"`. Consider using a simple token overlap approach rather than full fuzzy matching to avoid false positives.

### SiRADIG Person Selection

The current code in `siradig-navigator.ts` (lines ~600-621) selects the first row from `#tabla_cargas_familia`. The new logic should:

1. Read all rows from the table
2. For each row, extract the document number and/or name
3. Find the row matching the linked dependent's `numeroDoc` or `apellido`+`nombre`
4. Click that specific row instead of `.first()`

### Affected Files

- `prisma/schema.prisma` — add `familyDependentId` to `Invoice`
- `src/lib/automation/siradig-navigator.ts` — replace hardcoded first-row selection with dependent-aware selection
- `src/app/api/facturas/route.ts` — trigger auto-linking on create
- `src/app/api/facturas/[id]/route.ts` — allow manual linking via update, re-link on category change
- `src/components/facturas/` — show linked dependent, add selector for education facturas
- `src/lib/` — new matching utility (e.g. `src/lib/matching/dependent-matcher.ts`)

## Out of Scope

- Linking non-education facturas to dependents (other categories don't require person selection in SiRADIG)
- Bulk re-linking existing facturas (can be done as a follow-up migration script)
- Changing how cargas de familia are imported from SiRADIG (handled by the existing pull flow)
