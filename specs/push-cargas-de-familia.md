---
title: Push "Cargas de Familia" from desgrava.ar to ARCA/SiRADIG
status: implemented
priority: medium
---

## Summary

An automation should login with the user's ARCA credentials, navigate to "Detalles de las cargas de familia" within SiRADIG's "Carga de Formulario", and sync the user's locally-managed family dependents from desgrava.ar into SiRADIG. For each dependent in desgrava.ar, the automation should check if the person already exists in SiRADIG (matched by documento number) and either update the existing row or create a new one.

This is the counterpart to the pull feature and allows users to manage their cargas de familia within desgrava.ar and push changes upstream, keeping SiRADIG in sync without manual data entry.

## Acceptance Criteria

- [ ] A new "Exportar a SiRADIG" button should be added to the "Cargas de Familia" section alongside the existing "Importar desde SiRADIG" button
- [ ] The button should be disabled if the user has no dependents for the selected fiscal year
- [ ] The automation should navigate to "Detalles de las cargas de familia" in SiRADIG and iterate over existing rows to build a map of what's already there (matched by documento number)
- [ ] For each dependent in desgrava.ar: if a matching row exists in SiRADIG, click its edit button and update the form fields; if no matching row exists, click "Agregar" to create a new entry and fill in all fields. Not all fields are editable in SiRADIG, check which ones aren't to avoid the automation to fail.
- [ ] All form fields should be populated: parentesco, tipo/numero documento, apellido, nombre, fecha de nacimiento, fecha de union (when applicable), porcentaje deduccion (when applicable), CUIT otro deduccion (when applicable), familia a cargo, residente, tiene ingresos, monto ingresos (when applicable), mes desde, mes hasta, and proximos periodos
- [ ] After filling each entry's form, the automation should click "Guardar" and confirm the row was saved before proceeding to the next
- [ ] The push result should report how many dependents were created vs updated in SiRADIG
- [ ] Real-time progress should be visible to the user via SSE logs, same as the pull and invoice submission flows
- [ ] If the user navigates away and returns while the push is running, they should see the job's current status or final result

## Technical Notes

- Reuse the existing navigation path from `navigateToCargasFamilia` in `siradig-navigator.ts` to reach the cargas de familia table
- Add a new `JobType` enum value (e.g. `PUSH_FAMILY_DEPENDENTS`) and wire it through the automation API route, job processor, and UI
- To match existing SiRADIG rows, scan the table for documento numbers before making changes (similar to how the pull reads rows). This avoids creating duplicates
- Form field selectors for writing are the same IDs used by the pull extraction (e.g. `#tipo_doc_cf`, `#nro_doc_cf`, `#apellido_cf`, etc.) — values should be set via `page.select()` for dropdowns and `page.fill()` for text inputs
- The push should be async and queued like all other automation jobs to respect the single-browser concurrency model
- After each row is saved, wait for the table to re-render before proceeding to the next dependent

## Out of Scope

- Deleting dependents from SiRADIG that no longer exist in desgrava.ar (users should remove rows manually in SiRADIG to avoid accidental data loss)
- Conflict resolution if the same dependent was modified in both desgrava.ar and SiRADIG since the last sync — the push always overwrites SiRADIG with the local state
- Pulling dependents before pushing (the user can trigger a pull separately if they want to reconcile first)
