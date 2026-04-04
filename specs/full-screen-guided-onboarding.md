---
title: Full-Screen Guided Onboarding Flow
status: implemented
priority: high
---

## Summary

Replace the current non-blocking onboarding tour with a full-screen guided flow that prevents dashboard access until all steps are completed. The flow walks new users through the entire desgrava.ar value proposition in one session: entering ARCA credentials, pulling their tax profile, importing invoices, and submitting their first deduction to SiRADIG — ending with a confetti celebration as the dashboard fades in. This ensures every new user experiences the core product loop before exploring on their own.

## Acceptance Criteria

### Overall flow

- [ ] New users see a full-screen onboarding overlay (`fixed inset-0 z-50`) that blocks access to the dashboard until all 4 steps are completed
- [ ] The overlay shows a step indicator (1–4) with the current step highlighted and completed steps checked
- [ ] Users cannot skip steps or navigate to the dashboard while onboarding is in progress
- [ ] Onboarding completion is persisted in the DB (`onboardingCompleted` boolean on `User` model) so it only shows once
- [ ] Users who already completed onboarding (existing users, founders) never see the overlay
- [ ] A migration sets `onboardingCompleted = true` for all existing users so they are not affected
- [ ] All onboarding UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout
- [ ] All onboarding UI supports dark mode using semantic tokens (`bg-background`, `text-foreground`, `bg-muted`, etc.)

### Step 1: Credenciales ARCA

- [ ] Shows a centered card with CUIT and clave fiscal fields (reuses existing validation logic from `credentials-form.tsx`)
- [ ] On submit, saves credentials via `POST /api/credenciales`, then validates via `POST /api/credenciales/validar`
- [ ] Validation auto-triggers `PULL_PROFILE` job in the background (existing behavior)
- [ ] On successful validation, auto-advances to step 2
- [ ] Shows validation errors inline if credentials are wrong

### Step 2: Perfil impositivo (automatic pull)

- [ ] Immediately shows the progress of the `PULL_PROFILE` job that was auto-triggered in step 1
- [ ] Uses `StepProgress` component to show sub-steps (login → SiRADIG → datos personales → empleadores → cargas de familia → casas particulares → done)
- [ ] On `PULL_PROFILE` completion, shows a summary of what was imported (e.g., "2 empleadores, 3 cargas de familia")
- [ ] If the profile is empty (nothing imported), shows a message with a "Completar perfil manualmente" button that opens `/perfil` in a new tab or inline
- [ ] If the profile has data, shows a "Continuar" button to advance to step 3
- [ ] If `PULL_PROFILE` fails, shows an error with a "Reintentar" button and a "Omitir" (skip) button to continue without profile data

### Step 3: Importar comprobantes

- [ ] Shows a description of what will happen and an "Importar desde ARCA" button
- [ ] On click, triggers `PULL_COMPROBANTES` job and shows progress via `StepProgress`
- [ ] On completion, shows import result summary (e.g., "15 comprobantes importados, 8 deducibles")
- [ ] If no deducible invoices were found, shows a message and a "Continuar al panel" button that completes onboarding (skips step 4)
- [ ] If deducible invoices exist, shows a "Continuar" button to advance to step 4

### Step 4: Enviar primera deducción a SiRADIG

- [ ] Shows a simplified list of deducible invoices (not yet sent to SiRADIG) as selectable cards: provider name, amount, category
- [ ] User selects exactly one invoice
- [ ] "Enviar a SiRADIG" button triggers `SUBMIT_INVOICE` job for the selected invoice
- [ ] Shows progress via `StepProgress` (login → SiRADIG → fill → done)
- [ ] On successful submission, triggers confetti animation (canvas-confetti or similar)
- [ ] Simultaneously, the onboarding overlay fades out and the dashboard fades in behind it
- [ ] `onboardingCompleted` is set to `true` in the DB

### Edge cases

- [ ] If the user refreshes mid-onboarding, they resume at the correct step (derive from DB state: has credentials? has profile pull? has invoices?)
- [ ] If the user already has credentials (e.g., saved previously but didn't complete onboarding), skip step 1 and start at step 2

## Technical Notes

- **DB change**: Add `onboardingCompleted Boolean @default(false)` to the `User` model in `prisma/schema.prisma`. Create a migration that sets `onboardingCompleted = true` for all existing users (`UPDATE "User" SET "onboardingCompleted" = true`).
- **Onboarding component**: Create `src/components/onboarding/guided-onboarding.tsx` as the full-screen overlay. It renders inside `DashboardShell` (after providers) so it has access to `FiscalYearProvider` and auth context.
- **Step state derivation for resume**: On mount, query the user's state to determine which step to show:
  - No `ArcaCredential` → step 1
  - Has credentials, no completed `PULL_PROFILE` job → step 2 (check for active job to show progress)
  - Has profile data, no invoices → step 3
  - Has invoices, no completed `SUBMIT_INVOICE` job → step 4
- **Reuse existing components**: Credential validation logic from `credentials-form.tsx`, `StepProgress` from `shared/step-progress.tsx`, SSE streaming from `/api/automatizacion/{jobId}/logs`.
- **Confetti**: Use `canvas-confetti` npm package (lightweight, no framework dependency). Trigger from the center of the screen on step 4 completion.
- **Fade transition**: Use CSS transitions — onboarding overlay gets `opacity-0 pointer-events-none` with `transition-opacity duration-700`, dashboard behind it has `opacity-0` initially then `opacity-100` with matching transition.
- **API endpoint for completion**: Create `POST /api/onboarding/complete` (or reuse `/api/configuracion`) to set `onboardingCompleted = true`.
- **Dashboard shell integration**: In `dashboard-shell.tsx`, conditionally render `<GuidedOnboarding />` overlay when `onboardingCompleted === false`. Pass the flag from the server layout via props or a lightweight API call.
- **Mobile-first**: The centered card layout works naturally on mobile. Use `w-full max-w-lg mx-auto` for step content. Invoice selection cards should be full-width stacked.

## Out of Scope

- Allowing users to re-run onboarding after completion
- Onboarding for domestic workers / recibos salariales flow
- Email/notification-based onboarding reminders
- Onboarding analytics or step completion tracking beyond the boolean flag
- Editing imported invoices during onboarding (they go straight to the list)
- Bulk submission in step 4 (only one invoice)
