---
title: Unified Time-Weighted Progress Strip for All ARCA Imports
status: implemented
priority: medium
---

## Summary

The four ARCA import flows — perfil impositivo, comprobantes, recibos, and presentaciones — currently give the user three different progress experiences. Comprobantes and recibos already route through the persistent top progress strip (no modal, just a button-with-fill). Presentaciones still opens a blocking `ImportArcaPresentacionesDialog` with its own SSE step list. Perfil impositivo uses inline Loader2 + step text on `/perfil`. On top of that, even the strip-routed flows feel broken: the percent is computed as `completedSteps / totalSteps`, so `PULL_COMPROBANTES` jumps to ~60% in the first second (after `login` + `siradig` + `siradig_extract` resolve quickly) and then sits motionless for 30+ seconds while ARCA scrapes the comprobantes. This feature unifies all four imports under the same machinery — `ArcaImportButton` for the click target, the persistent strip for feedback, no modal — and replaces the step-index percent with a time-weighted percent that keeps moving while a long-running step is in flight, calibrated against per-job-type duration estimates so the bar reflects real expected wait time.

## Acceptance Criteria

### Unified UI: presentaciones

- [ ] Clicking "Importar desde ARCA" on `/presentaciones` POSTs `PULL_PRESENTACIONES` directly via `ArcaImportButton` — no modal opens
- [ ] The toolbar button on `/presentaciones` is rendered by `ArcaImportButton` in `mode="toolbar"`, matching the comprobantes/recibos pages exactly (icon-only at rest, expands on hover, shows progress fill while running, label switches to "Descargando…")
- [ ] `ImportArcaPresentacionesDialog` is deleted; `src/components/presentaciones/import-arca-dialog.tsx` is removed
- [ ] `PresentacionesInner` no longer holds `importOpen` / `activeImportJobId` state, no longer auto-resumes via `?activeJob=PULL_PRESENTACIONES`, and no longer renders the dialog
- [ ] List auto-refresh on completion: when `PULL_PRESENTACIONES` transitions to COMPLETED, `PresentacionesList` reloads exactly once (mirrors the existing `completedTypes` diff pattern used by `/comprobantes` and `/recibos`)
- [ ] Failures: the strip's amber banner handles errors via the link to `/automatizacion`; no inline error in the list view

### Unified UI: perfil impositivo

- [ ] The "Importar todo desde ARCA" button on `/perfil` is replaced by `ArcaImportButton` rendered in a layout-friendly mode (reuse `mode="card"` with full-width-on-mobile / auto-on-`sm`, or add a small new mode if `card` doesn't fit visually) so the page layout doesn't jump
- [ ] On click it enqueues `PULL_PROFILE` via the existing button enqueue path (no separate fetch, no separate SSE handler in the page)
- [ ] All ad-hoc state in `src/app/(dashboard)/perfil/page.tsx` is removed: `profileImporting`, `profileStep`, `eventSourceRef`, `connectToProfileSSE`, the active-job recovery `useEffect`, the inline step-text paragraph, and the `Loader2` mid-button spinner
- [ ] `PersonalDataSection`, `EmployersSection`, `FamilyDependentsSection`, `DomesticWorkersSection` continue to receive a `profileImporting` boolean and `refreshKey` — both are now derived from `useArcaImportProgress`: `profileImporting` is `true` while a `PULL_PROFILE` job is running for the current fiscal year; `refreshKey` is bumped exactly once when `completedTypes` includes `PULL_PROFILE` for the first time
- [ ] No new SSE connection is opened from `/perfil`; all status comes from the existing `useArcaImportProgress` poll

### `ArcaImportButton` extension

- [ ] `ImportableJobType` in `src/components/shared/arca-import-button.tsx` widens from `PULL_COMPROBANTES | PULL_DOMESTIC_RECEIPTS` to also include `PULL_PRESENTACIONES` and `PULL_PROFILE`
- [ ] The button's `isRunning` check (`snapshot.hasRunning && !snapshot.completedTypes.includes(jobType)`) continues to gate per-type — clicking a comprobantes button while a `PULL_PROFILE` job is running does NOT show the comprobantes button as running
- [ ] The button's percent fill reads from a new per-type percent (see "Time-weighted progress" below) — not the global strip percent — so each button reflects only its own job's progress
- [ ] `mode="card"` and `mode="toolbar"` are unchanged in API; an additional callsite-friendly variation may be added if needed for `/perfil` but only if `mode="card"` doesn't already fit

### Time-weighted progress

- [ ] A new constant `JOB_STEP_DURATIONS` in `src/lib/automation/job-steps.ts` (or a new `job-step-durations.ts` next to it) lists per-step expected duration in seconds for every tracked job type:
  - `PULL_COMPROBANTES`: login 5, siradig 5, siradig_extract 8, navigate_comprobantes 5, download 30, classify 12 (total ~65s)
  - `PULL_DOMESTIC_RECEIPTS`: login 5, siradig 5, siradig_extract 5, download 25, save 3, done 1 (total ~44s)
  - `PULL_PRESENTACIONES`: login 5, siradig 5, download 20, done 1 (total ~31s)
  - `PULL_PROFILE`: login 5, siradig 5, datos_personales 8, empleadores 8, cargas_familia 8, casas_particulares 15, done 1 (total ~50s)
  - Initial values are best-guess; mark in a comment that they should be revised once we have real telemetry
- [ ] `computeProgressSnapshot` in `src/lib/onboarding/progress-stages.ts` is updated so:
  - Each step contributes `JOB_STEP_DURATIONS[jobType][stepKey]` weight instead of `1`
  - `totalSteps` and `completedSteps` are renamed to `totalWeight` / `completedWeight` (in seconds), but `percent` semantics stay the same (Σ completed weight / Σ total weight, capped at 100)
- [ ] `JobLite` is extended with `currentStepStartedAt: Date | null`, populated from a new `Job.currentStepStartedAt` column (see DB column path below). The aggregator uses it to add a partial-step weight while the step is running:
  - `inFlightWeight = max(0, min(stepWeight × 0.9, (now - currentStepStartedAt) seconds))` — capped at 90% of the step's expected weight so we never display 100% before the step actually finishes
  - This adds to `completedWeight` so the bar gradually moves between step transitions
- [ ] The aggregator runs on every `useArcaImportProgress` tick (4s) **and** every 1 second on the client while a job is running, so the bar visibly creeps even between API polls — implement via a separate `setInterval(_, 1000)` inside the hook that re-derives the snapshot from the cached job list using the current wall clock, not via re-polling the API. Tear it down once `allDone || !hasRunning`
- [ ] Per-type percent: `aggregateImportProgress` returns a `percentByType: Record<TrackedJobType, number>` map alongside the global `percent`, so individual `ArcaImportButton`s can show their own progress

### Job processor + DB column

- [ ] Add `currentStepStartedAt DateTime?` to the `Job` model in `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name add_job_current_step_started_at` and `npx prisma generate`
- [ ] Update every callsite in `src/lib/automation/job-processor.ts` that advances `currentStep` to also set `currentStepStartedAt: new Date()` in the same `prisma.job.update`
- [ ] On RUNNING start, `currentStepStartedAt` is set to the same instant as `currentStep` going to its first value
- [ ] `/api/automatizacion` GET response includes `currentStepStartedAt` in the `ApiJobLite` shape (serialized as ISO string; aggregator parses to `Date`)

### Strip behavior

- [ ] No visual change to the strip itself — same banner, same color states, same auto-hide timing — only the percent number it receives changes
- [ ] When all four import types run simultaneously (e.g., user fires `PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES`, `PULL_PROFILE` in quick succession), the strip's global percent is the time-weighted aggregate across all running jobs (sum of weights, not arithmetic mean)
- [ ] The "stage label" in the strip continues to reflect the highest-priority running stage (existing logic), unchanged

### Mobile / responsive / a11y / dark mode

- [ ] All four toolbar/card buttons remain ≥44px tap targets on screens ≥320px wide
- [ ] The new `currentStepStartedAt` field has no UI surface beyond the strip's percent — no new copy
- [ ] The button's `aria-valuenow` continues to reflect the per-type percent
- [ ] Dark mode unchanged — uses the existing `bg-primary/15` / `bg-foreground/15` fill tokens

### Tests

- [ ] `progress-stages.test.ts` adds cases for time-weighted percent: a 5-step job where step 3 has weight 30s and step 1 has weight 5s should show ~9% after step 1 completes, not 33%
- [ ] `progress-stages.test.ts` adds cases for in-flight partial-step weight: a job sitting on `download` for 15 seconds (expected 30s) shows ~50% of that step's weight added to the bar, capped at 90%
- [ ] `aggregate-progress.test.ts` adds cases for `percentByType` and multi-job aggregation
- [ ] Existing 940-test suite continues to pass

## Technical Notes

- **Three concurrent fixes, one PR**: this spec bundles unification (presentaciones + perfil) and the percent-formula change because they touch the same surface area. Splitting would mean writing the time-weight code twice (once for the modal, once after deletion).
- **Single source of truth for percent**: `computeProgressSnapshot` is already that source — only the formula and inputs change. No duplicate percent calculation in `ArcaImportButton` or `ArcaProgressStrip`; both keep reading from the snapshot.
- **Why per-type duration estimates and not server-derived telemetry**: we don't have enough finished-job data yet (just family beta-testers). Hardcoded estimates with a TODO comment are the lowest-friction path to "the bar moves believably." Real percentile-based durations are a follow-up.
- **Client-side ticking interval**: a `setInterval(_, 1000)` inside `useArcaImportProgress` that re-runs `aggregateImportProgress` against the _cached_ job list (without a network call) keeps the bar smooth between 4s polls. Tear it down once `allDone || !hasRunning`.
- **Existing dedup**: `POST /api/automatizacion` already returns 409 on duplicate active jobs of the same type. `ArcaImportButton`'s 409 handling stays as-is.
- **`currentStepStartedAt` semantics**: this is the wall-clock time when `currentStep` was set to its current value. The aggregator computes `now - currentStepStartedAt` to estimate how far into the in-flight step we are. Migration is non-destructive (nullable column) so existing rows are fine.
- **Files modified**:
  - `src/components/shared/arca-import-button.tsx` — widen `ImportableJobType`, expose per-type percent
  - `src/lib/automation/job-steps.ts` — add `JOB_STEP_DURATIONS` table
  - `src/lib/onboarding/progress-stages.ts` — time-weighted percent + in-flight partial weight
  - `src/lib/onboarding/aggregate-progress.ts` — return `percentByType`, parse `currentStepStartedAt`
  - `src/hooks/use-arca-import-progress.ts` — add 1s client-side re-derive interval
  - `src/app/(dashboard)/presentaciones/page.tsx` — replace dialog with `ArcaImportButton`
  - `src/app/(dashboard)/perfil/page.tsx` — replace inline SSE flow with `ArcaImportButton` + hook-derived state
  - `src/lib/automation/job-processor.ts` — set `currentStepStartedAt` on every `currentStep` advance
  - `src/app/api/automatizacion/route.ts` — include `currentStepStartedAt` in the GET response
  - `prisma/schema.prisma` — add `currentStepStartedAt DateTime?` to `Job`
- **Files deleted**:
  - `src/components/presentaciones/import-arca-dialog.tsx`
- **Files NOT touched**:
  - `src/components/onboarding/onboarding-step-profile.tsx` — onboarding has its own purpose-built progress UI; reusing the strip during onboarding is a separate spec
  - `src/components/layout/arca-progress-strip.tsx` — already type-agnostic, no behavior change
  - The job processor's step list and existing job step keys — only `currentStepStartedAt` is added
- **Mobile-first**: no new layout work; reusing existing `ArcaImportButton` modes that already work on 320px

## Out of Scope

- Onboarding's `PULL_PROFILE` flow in `onboarding-step-profile.tsx` — the post-onboarding strip is mounted via `DashboardShell` and onboarding has its own progress UI; unifying that is a separate spec
- Replacing the per-row submit progress on `/comprobantes` and `/recibos` (each row's `JobStatusBadge` + `JobHistoryPanel` for `SUBMIT_INVOICE`/`SUBMIT_DOMESTIC_DEDUCTION`) — those are not "imports" and stay row-local
- Empirically-derived step durations from historical job logs — initial values are hardcoded estimates with a TODO
- Changing the strip's collapse/auto-hide behavior or visual design
- Pause / cancel / retry buttons on the strip or any button
- Per-page mini-strip variants — the single mounted strip in `DashboardShell` stays
- Removing the `skippedArcaDialogs` `UserPreference` field (presentaciones used it; once the dialog is deleted, the field may be orphaned, but its cleanup is a follow-up since `family-dependents.tsx` may still write to it)
- Migrating any non-import flow (`SUBMIT_*`, `PUSH_*`, `VALIDATE_CREDENTIALS`) to the strip
- A "details" expandable panel under the strip showing per-step progress — kept simple
