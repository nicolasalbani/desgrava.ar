---
title: Remove Fiscal Year From Onboarding
status: implemented
priority: medium
---

## Summary

The onboarding tour currently includes a "Seleccionar año fiscal" step that adds friction to the setup flow. Since the vast majority of users work with the current fiscal year, this step should be removed from onboarding. The fiscal year defaults to the current year automatically via `FiscalYearProvider`, and users who need a different year can still change it from the header selector.

## Acceptance Criteria

- [ ] The onboarding tour no longer includes the "Año fiscal" step (removed from the steps array in `onboarding-tour.tsx`)
- [ ] Remaining onboarding steps are renumbered correctly (Credenciales → Perfil impositivo → Cargar comprobantes → Desgravar)
- [ ] The `FiscalYearProvider` defaults to `new Date().getFullYear()` when no user preference is stored (no explicit selection required)
- [ ] The `open-fiscal-year-selector` custom event dispatch and listener can be removed if no longer used elsewhere
- [ ] The fiscal year selector in the dashboard header remains fully functional for users who want to switch years
- [ ] The onboarding "completed" check no longer depends on a fiscal year being explicitly selected

## Technical Notes

- The onboarding steps are defined in `src/components/dashboard/onboarding-tour.tsx`. Remove step 2 ("Año fiscal") from the steps array and adjust the remaining step numbers.
- The `openFiscalYearSelector()` function and the `open-fiscal-year-selector` custom event bridge between `onboarding-tour.tsx` and `dashboard-header.tsx`. If this event is only used by the onboarding step, remove both the dispatch and the event listener.
- `src/contexts/fiscal-year.tsx` already falls back to current year when no preference is stored — verify this works correctly when `defaultFiscalYear` is null in the DB.
- The dashboard page (`src/app/(dashboard)/dashboard/page.tsx`) also has server-side fallback: `userPreference?.defaultFiscalYear ?? new Date().getFullYear()`.

## Out of Scope

- Removing the fiscal year selector from the dashboard header (it stays for manual switching)
- Changing the fiscal year read-only logic (`src/lib/fiscal-year.ts`)
- Modifying the `UserPreference` schema or removing the `defaultFiscalYear` column
- Auto-switching fiscal year based on date (e.g., January showing previous year)
