---
title: Onboarding Step 2 — Inline Employer Registration
status: implemented
priority: high
---

## Summary

When the onboarding profile pull (step 2) completes and detects no employers in SiRADIG, instead of silently auto-completing the onboarding, present the user with a choice: add an employer on the spot (with a form + push to SiRADIG), or skip and continue to the dashboard with a clear warning that deductions won't work until they have at least one employer. This ensures users aren't silently dropped out of the onboarding without understanding why, and gives them an immediate path to fix the issue.

## Acceptance Criteria

### No-employer detection UI

- [ ] When the `PULL_PROFILE` job completes and `employers === 0`, step 2 shows a prominent alert explaining that no employers were found in SiRADIG
- [ ] Two action paths are presented: "Agregar empleador" (primary button) and "Continuar sin empleador" (secondary/text button)
- [ ] The profile summary (family dependents, domestic workers, personal data) is still shown above the alert so the user sees what was imported

### Add employer inline

- [ ] Clicking "Agregar empleador" opens a dialog/card with the employer form: CUIT, Razón Social, Fecha Inicio, Fecha Fin (optional), Agente de Retención — same fields and validation as `EmployersSection`
- [ ] On form submit, the employer is saved to the DB via `POST /api/empleadores`
- [ ] Immediately after saving, a `PUSH_EMPLOYERS` job is triggered to register the employer in SiRADIG
- [ ] `StepProgress` shows the push job progress (login → SiRADIG → upload → done)
- [ ] On successful push, the flow auto-advances to step 3 (import comprobantes) after a short delay
- [ ] If the push job fails, an error message is shown with a "Reintentar" button (re-triggers `PUSH_EMPLOYERS`) and a "Continuar sin empleador" fallback
- [ ] After adding the employer, `EmployerCountProvider` is invalidated so the sidebar updates

### Skip without employer (warning path)

- [ ] Clicking "Continuar sin empleador" shows a confirmation dialog/alert with a warning: the user won't be able to deduct anything until they add at least one employer from the Perfil impositivo page
- [ ] After the user confirms, onboarding auto-completes (skips steps 3 & 4) — same as current behavior
- [ ] The warning text includes a reference to where they can add employers later ("Perfil impositivo → Empleadores")

### Resume / refresh handling

- [ ] If the user refreshes during the employer form or push job, step 2 resumes correctly: detects the active `PUSH_EMPLOYERS` job and shows its progress
- [ ] If the user refreshes after the push completed but before advancing, detects that employers now exist and shows the "Continuar" button

### Responsiveness

- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout
- [ ] Employer form dialog is full-width on mobile
- [ ] Touch targets are at least 44px

## Technical Notes

- **Component changes**: Modify `OnboardingStepProfile` (`src/components/onboarding/onboarding-step-profile.tsx`) to handle the no-employer case. Instead of calling `onComplete(false)` immediately, show the inline employer registration UI.
- **Employer form**: Extract the form from `EmployersSection` (`src/components/perfil/employers-section.tsx`) into a shared component (or duplicate the form fields inline in the onboarding step — pragmatic choice since it's a single use). Reuse the same Zod schema for validation.
- **Push job trigger**: After `POST /api/empleadores` succeeds, call `POST /api/automatizacion` with `jobType: "PUSH_EMPLOYERS"`, `fiscalYear`, and the new `employerId`. Connect to SSE for progress tracking — same pattern used in `EmployersSection`.
- **Auto-advance after push**: On `PUSH_EMPLOYERS` completion, call `onComplete(true)` which triggers `advanceToStep(3)` in `guided-onboarding.tsx`.
- **Skip path**: The "Continuar sin empleador" confirmation can use a simple `AlertDialog` from shadcn/ui. On confirm, call `onComplete(false)` which triggers `completeOnboarding()` in `guided-onboarding.tsx` — existing behavior.
- **Resume logic**: In `/api/onboarding/state`, when `step === 2` and `profilePullCompleted === true` and `hasEmployers === false`, check for an active `PUSH_EMPLOYERS` job. If found, return its ID so the component can reconnect to SSE. Add `activePushEmployersJobId` to the state response.
- **EmployerCountProvider invalidation**: After the push job succeeds, call `invalidate()` from `useEmployerCount()` so the sidebar "Comprobantes deducibles" link becomes enabled.
- **Step 2's `onComplete` signature**: Currently `onComplete(hasEmployers: boolean)`. No change needed — `true` advances to step 3, `false` auto-completes.

## Out of Scope

- Adding multiple employers during onboarding (one is sufficient)
- Editing or deleting the employer added during onboarding (user can do this later in Perfil impositivo)
- Pulling employers again after adding one (the initial pull already found none)
- Handling the case where SiRADIG already has an employer but the pull failed to detect it (edge case for manual debugging)
- Monthly salary amounts for the employer (excluded from employer management entirely per existing spec)
