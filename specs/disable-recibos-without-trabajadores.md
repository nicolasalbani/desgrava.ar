---
title: Disable Recibos Salariales Without Trabajadores
status: implemented
priority: medium
---

## Summary

When a user has no domestic workers registered in "Trabajadores a cargo" (within Perfil impositivo), the "Recibos salariales" sidebar link should be visually disabled with a tooltip explaining why. The recibos page itself should show an empty state directing users to register workers first. This prevents confusion since salary receipts are meaningless without associated workers.

## Acceptance Criteria

- [ ] Dashboard sidebar: "Recibos salariales" nav item is visually disabled (grayed out, not clickable) when the user has zero `DomesticWorker` records for the current fiscal year
- [ ] Dashboard sidebar: Disabled item shows a tooltip on hover: "Primero registrá trabajadores a cargo en Perfil impositivo"
- [ ] Mobile nav: Same disabled behavior and tooltip for the "Recibos salariales" item
- [ ] If a user navigates directly to `/recibos` with no workers, the page shows an empty state with a message and a link to the Perfil impositivo page (trabajadores section)
- [ ] When the user adds their first worker, the sidebar item becomes enabled without requiring a page reload (client-side state update)
- [ ] When the user deletes all workers, the sidebar item becomes disabled again
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

## Technical Notes

- The sidebar (`dashboard-sidebar.tsx`) and mobile nav (`dashboard-mobile-nav.tsx`) currently use a static `navItems` array. The "Recibos salariales" item needs to be conditionally styled based on a worker count check.
- Fetch worker count via `/api/trabajadores?fiscalYear={year}` — check `workers.length === 0`. Consider a lightweight endpoint or adding a count-only param to avoid fetching full worker data just for the sidebar.
- Use the `useFiscalYear()` context already available in the dashboard layout to determine the current fiscal year.
- For the disabled nav item, use `pointer-events-none opacity-50` with a Radix `Tooltip` wrapping it.
- The recibos page (`src/app/(dashboard)/recibos/page.tsx`) empty state should use the same pattern as other empty states in the app.

## Out of Scope

- Blocking receipt creation via API when no workers exist (backend validation)
- Hiding the nav item entirely (it should remain visible but disabled)
- Cascading deletion of receipts when all workers are removed
- Disabling receipt-related automation jobs
