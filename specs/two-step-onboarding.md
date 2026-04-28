---
title: Trim Onboarding to Credentials + Perfil Only
status: implemented
priority: high
---

## Summary

Today's blocking onboarding has 4 steps — Credenciales ARCA, Perfil impositivo, Importar comprobantes, Primera deducción — which delays a first-time user 5–10 minutes before they ever reach the dashboard. Now that the post-onboarding dashboard tour, ARCA progress strip, and "Próximo paso" card exist, those last two steps are no longer needed inside onboarding: the comprobantes import already runs as a background job after onboarding completes, and the "Próximo paso" card naturally surfaces the first-deduction call to action once imports finish. This spec trims the blocking flow to just steps 1 and 2 so users hit the dashboard within ~1–2 minutes, with imports continuing in the background and the tour acting as the explanatory layer. [Lenny: Scott Belsky's "first mile / first 15 minutes" via Grant Lee, Gamma — shorten time-to-value]

## Acceptance Criteria

### Flow

- [ ] The blocking onboarding overlay shows a **2-step** indicator (was 4): "Credenciales ARCA" and "Perfil impositivo"
- [ ] Step 1 keeps its current behavior: validate credentials, trigger `PULL_PROFILE`, advance to step 2 once the job reaches the `datos_personales` step (per the existing `faster-onboarding-deferred-jobs.md` pattern)
- [ ] Step 2 keeps its current behavior: stream `PULL_PROFILE` progress; on completion, call `POST /api/onboarding/complete` and fade out the overlay
- [ ] If `PULL_PROFILE` returns no employers, the flow still completes (no longer branches to a removed step) — user lands on the dashboard
- [ ] On dashboard arrival, the existing post-onboarding tour auto-opens (welcome modal → 4 spotlights → completion) and the ARCA progress strip shows the running background imports — no change here, just confirming the handoff stays intact
- [ ] The "wow" moment shifts from "your first deduction was submitted" to "you're on the dashboard, your data is being fetched in real time, here's what's coming" [Lenny: Elena Verna — "It just needs to be a wow moment"]

### Background jobs (unchanged, but reaffirmed)

- [ ] `POST /api/onboarding/complete` continues to enqueue `PULL_COMPROBANTES` (full extraction, no `skipSiradigExtraction`), `PULL_DOMESTIC_RECEIPTS`, and `PULL_PRESENTACIONES` after setting `onboardingCompleted = true`
- [ ] The deferred `PULL_COMPROBANTES` no longer needs the `skipSiradigExtraction=true` shortcut since there is no foreground onboarding step that runs it — onboarding never triggers `PULL_COMPROBANTES` itself
- [ ] The first-deduction call to action moves entirely to the post-onboarding "Próximo paso" card (branch 2: "Revisá y presentá {currentMonthName}"), which is already implemented [Lenny: Amol Avasare / Cat Wu — frame day-zero/day-one experience as the activation surface, then let the product do the work]

### Code cleanup (surgical, no orphaned modules)

- [ ] `src/components/onboarding/onboarding-step-invoices.tsx` is deleted
- [ ] `src/components/onboarding/onboarding-step-submit.tsx` is deleted
- [ ] `src/components/onboarding/guided-onboarding.tsx` is updated: imports for the two removed steps are gone, `STEP_LABELS` becomes a 2-element array, the `currentStep === 3` and `currentStep === 4` branches are removed, the `pullProfileJobId` handoff stays
- [ ] `OnboardingState` type and `/api/onboarding/state` response shed the now-unused fields: `activePullComprobantesJobId`, `activeSubmitInvoiceJobId`, `deducibleInvoiceCount`, `hasCompletedSubmission`
- [ ] No remaining import or reference to the deleted components / fields anywhere in `src/`
- [ ] `npm run lint && npm run format:check && npm run build && npm run test` all pass

### Edge cases / mid-flight users

- [ ] A user who was previously mid-step-3 (had credentials, profile pulled, no completed submission) auto-completes onboarding on next visit because the resume logic now caps at step 2 — no error, no stuck state
- [ ] A user who was previously mid-step-4 (active `SUBMIT_INVOICE` job) similarly auto-completes; the submit job continues in the background and shows up in the regular invoice list / job history once it finishes
- [ ] The PR includes a one-paragraph note in the description about this transition behavior so it's visible during review

### UI / responsive / a11y

- [ ] The 2-step indicator renders correctly on screens as narrow as 320px (`gap-2 sm:gap-3` already in place handles it; visually verify the connector line still looks balanced with only one gap between dots)
- [ ] All onboarding UI continues to support dark mode via semantic tokens (`bg-background`, `text-foreground`, `bg-muted`, `bg-primary`, `text-primary-foreground`) — no raw color classes added
- [ ] Touch targets on step controls remain ≥44px

## Technical Notes

- **Files modified**: `src/components/onboarding/guided-onboarding.tsx`, `src/app/api/onboarding/state/route.ts`. The completion flow (`POST /api/onboarding/complete`) does not change.
- **Files deleted**: `src/components/onboarding/onboarding-step-invoices.tsx`, `src/components/onboarding/onboarding-step-submit.tsx`. Per CLAUDE.md "Surgical Changes" rule, also delete imports/exports/types orphaned by these removals (do not leave commented-out code or `// removed` markers).
- **No DB change**: `User.onboardingCompleted` semantics stay the same (set to `true` after step 2 instead of step 4). No migration needed.
- **No new tests**: this is a deletion/simplification; the remaining steps already have their own runtime checks. Existing test suite must still pass.
- **No new business logic in `src/lib/`**: nothing to add to `src/lib/onboarding/`.
- **Background-job continuity**: the existing deferred jobs in `POST /api/onboarding/complete` are the substitute for the removed in-onboarding `PULL_COMPROBANTES`. The dashboard tour and ARCA progress strip explain what's happening to the user.
- **`skipSiradigExtraction` flag**: stays in the API for future use but no caller in the onboarding flow sets it to `true` anymore. Document this in the PR description; do not remove the flag plumbing in this spec (out of scope).
- **First-mile philosophy** [Lenny: Grant Lee, Gamma]: the goal is "shorten that time-to-value as much as possible" — Belsky's first-15-minutes framing. By offloading comprobantes and the first submit to the background + tour + Próximo paso card, the blocking flow reduces from ~5–10 min to ~1–2 min.
- **Wow vs aha** [Lenny: Elena Verna]: we're not waiting for the user to experience the full submit loop in onboarding. The wow becomes "the app is already pulling my entire ARCA profile while I get oriented," with the actual submit happening voluntarily once the user trusts the data.
- **Mobile-first**: the existing onboarding overlay is already mobile-first (`max-w-lg mx-auto` content, `gap-2 sm:gap-3` step indicator, full-screen container). No new mobile work needed beyond verifying the 2-dot indicator looks balanced.

## Out of Scope

- Adding a new "submit your first deduction" prompt anywhere in the dashboard tour (the "Próximo paso" card branch 2 already covers this)
- Changing the post-onboarding background jobs (`PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES`) — they continue exactly as today
- Removing the `skipSiradigExtraction` API parameter and its job-processor branch (left in place for potential future use)
- Funnel/analytics events for the new 2-step flow vs the old 4-step flow (no measurement work in this spec)
- Localizing the onboarding copy beyond Spanish
- Touching the dashboard tour itself, the ARCA progress strip, or the "Próximo paso" card
- Editing `PULL_PROFILE` behavior, step list, or progress UI
- Reintroducing a non-blocking onboarding/tour overlay variant
- Cleanup of old, unused background-job code paths beyond the components and API fields explicitly named above
