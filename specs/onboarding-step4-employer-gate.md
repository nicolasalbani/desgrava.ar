---
title: Onboarding Step 4 & Facturas Employer Gate
status: implemented
priority: medium
---

## Summary

Three related changes to enforce that "comprobantes deducibles" are only relevant when the user has at least one employer: (1) show the invoice date alongside each comprobante in the onboarding step 4 list, (2) skip step 4 entirely if the user has no employers after step 2, and (3) disable the "Comprobantes deducibles" sidebar link (same pattern as recibos/trabajadores) when the user has no employers for the current fiscal year.

## Acceptance Criteria

### Step 4: Show invoice date in comprobante list

- [ ] Each comprobante card in `OnboardingStepSubmit` displays the `invoiceDate` formatted as `DD/MM/YYYY` (e.g., "15/03/2026") below the category label
- [ ] If `invoiceDate` is null, show "Sin fecha" in muted text
- [ ] The date text uses `text-xs text-muted-foreground` consistent with the category label style

### Step 4: Skip when no employers

- [ ] The `/api/onboarding/state` endpoint includes a new `hasEmployers` boolean field (true if the user has at least one `Employer` record for the current fiscal year)
- [ ] The step indicator always shows 4 steps (since employer state is unknown until step 2 completes)
- [ ] When `hasEmployers` is false and the user would otherwise advance to step 4 (after step 3), the onboarding auto-completes — calls `/api/onboarding/complete` and transitions to the dashboard
- [ ] If the profile pull in step 2 fails or is skipped, treat as no employers (skip step 4)

### Sidebar: Disable "Comprobantes deducibles" without employers

- [ ] Create an `EmployerCountProvider` context (mirroring `DomesticWorkerCountProvider`) that exposes `{ hasEmployers, loading, invalidate }`
- [ ] Fetch employer count via `/api/empleadores?fiscalYear={year}&count=true` (add `count=true` support to the endpoint if not present)
- [ ] Dashboard sidebar: "Comprobantes deducibles" nav item is visually disabled (grayed out, not clickable) when `hasEmployers` is false
- [ ] Dashboard sidebar: Disabled item shows a tooltip on hover: "Primero importá tu perfil impositivo con al menos un empleador"
- [ ] Mobile nav: Same disabled behavior and tooltip for the "Comprobantes deducibles" item
- [ ] If a user navigates directly to `/facturas` with no employers, the page shows an empty state with a message and a link to the Perfil impositivo page
- [ ] When employers are added (e.g., after a profile pull), the sidebar item becomes enabled without requiring a page reload (via `invalidate()`)
- [ ] All new UI works on screens as narrow as 320px

## Technical Notes

- **Invoice date in step 4**: The `/api/facturas` endpoint already returns `invoiceDate`. Add it to the `InvoiceOption` interface in `onboarding-step-submit.tsx` and include it in the `map()` that builds the options. Format with `toLocaleDateString('es-AR')`.
- **Skip step 4 logic**: In `/api/onboarding/state/route.ts`, add an `Employer` count query to the existing `Promise.all`. When `employerCount === 0` and the user would be at step 4, return `step: 4` with `hasEmployers: false`. The `GuidedOnboarding` component should detect this combination and auto-complete.
- **Employer count context**: Follow the exact pattern of `src/contexts/domestic-worker-count.tsx` — create `src/contexts/employer-count.tsx` with `EmployerCountProvider` and `useEmployerCount()`. Wire it into `DashboardShell` alongside the existing `DomesticWorkerCountProvider`.
- **Sidebar disable pattern**: Reuse the exact pattern from `dashboard-sidebar.tsx:66-84` (the recibos disable logic) — `isDisabled` check, `TooltipProvider` wrapper, `cursor-not-allowed opacity-50` styling. Apply the same to `dashboard-mobile-nav.tsx`.
- **Empleadores API count param**: If `/api/empleadores` doesn't support `count=true`, add it following the same pattern as `/api/trabajadores` — return `{ count: N }` instead of full records.

## Out of Scope

- Blocking invoice creation via API when no employers exist (backend validation)
- Hiding the nav item entirely (it should remain visible but disabled)
- Cascading deletion of invoices when employers are removed
- Disabling invoice-related automation jobs when no employers
