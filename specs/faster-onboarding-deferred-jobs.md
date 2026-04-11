---
title: Faster Onboarding with Deferred Background Jobs
status: implemented
priority: high
---

## Summary

The onboarding flow takes too long because (1) step 2 starts with no visual feedback while the PULL_PROFILE job logs in and navigates SiRADIG, (2) step 3 wastes ~30-60s extracting "comprobantes deducidos" from SiRADIG which isn't needed during onboarding, and (3) several data pulls (recibos salariales, presentaciones) don't run at all until the user manually triggers them later. This spec moves the ARCA login + SiRADIG entry into step 1 so the user sees immediate progress after entering credentials, skips the SiRADIG extraction phase during onboarding to make step 3 faster, and queues background jobs (pull comprobantes deducidos, pull recibos salariales, pull presentaciones) automatically after onboarding completes.

## Acceptance Criteria

### Step 1: Login to ARCA + enter SiRADIG immediately after credential validation

- [ ] After credentials are validated in step 1, the PULL_PROFILE job is triggered as before, but the step 1 UI now shows progress for the login + SiRADIG entry phases ("Verificando credenciales" spinner transitions to "Conectando con ARCA" and "Abriendo SiRADIG")
- [ ] Step 1 only advances to step 2 once the PULL_PROFILE job reaches the `datos_personales` step (meaning login + SiRADIG are done)
- [ ] Step 2 starts showing progress from `datos_personales` onward — no more dead time at the beginning

### Step 3: Skip SiRADIG extraction during onboarding

- [ ] The PULL_COMPROBANTES job accepts an optional `skipSiradigExtraction` parameter
- [ ] When `skipSiradigExtraction=true`, the job skips the `runSiradigExtractionPhase` call entirely and goes straight to the Mis Comprobantes CSV import
- [ ] The onboarding step 3 component passes `skipSiradigExtraction=true` when creating the job
- [ ] The onboarding step 3 UI only shows 2 steps: "Extrayendo comprobantes deducibles" and "Clasificando proveedores" (no "Extrayendo comprobantes deducidos")
- [ ] Non-onboarding PULL_COMPROBANTES jobs (from the dashboard) continue to include the SiRADIG extraction phase as before

### Post-onboarding background jobs

- [ ] When `POST /api/onboarding/complete` is called, it queues 3 background jobs after setting `onboardingCompleted=true`:
  1. `PULL_COMPROBANTES` with `skipSiradigExtraction=false` (full import including SiRADIG extraction) for the current fiscal year
  2. `PULL_DOMESTIC_RECEIPTS` for the current fiscal year
  3. `PULL_PRESENTACIONES` for the current fiscal year
- [ ] Jobs are only created if the user has ARCA credentials and employers (required for SiRADIG access)
- [ ] Each job is created with `status: "PENDING"` and processed via the existing per-user queue
- [ ] If any of these job types already has an active (PENDING/RUNNING) job, that type is skipped (no duplicates)
- [ ] The user lands on the dashboard immediately — background jobs run silently

## Technical Notes

### Step 1 → Step 2 handoff

Currently, step 1 calls `onComplete(pullProfileJobId)` immediately after triggering PULL_PROFILE. Step 2 then connects to the SSE stream and shows progress from the beginning (including login/SiRADIG which have no UI steps visible).

The change: step 1 should connect to the PULL_PROFILE SSE stream and wait for the `datos_personales` step event before calling `onComplete`. The step 1 UI can show a secondary progress state after validation succeeds: "Conectando con ARCA..." while waiting. This gives the user visual feedback instead of a blank step 2.

In `onboarding-step-credentials.tsx`: after getting `pullProfileJobId` from validation, connect to SSE at `/api/automatizacion/{jobId}/logs` and wait for `data.step === "datos_personales"` before calling `onComplete(pullProfileJobId)`.

### skipSiradigExtraction parameter

In `POST /api/automatizacion` route: accept `skipSiradigExtraction` boolean in the request body for `PULL_COMPROBANTES` jobs. Store it in `resultData` (e.g., `{ skipSiradigExtraction: true }`).

In `processJob` for `PULL_COMPROBANTES`: check `(job.resultData as any)?.skipSiradigExtraction`. If true, skip the `runSiradigExtractionPhase` try/catch block and go directly to `processPullComprobantes`.

### Post-onboarding job creation

In `POST /api/onboarding/complete`: after setting `onboardingCompleted = true`, check for credentials and employers. If present, create the 3 jobs using the same pattern as other job creation in the API route (check for active duplicates, create with PENDING status, enqueue via `after()`).

Import `processJob` from `@/lib/automation/job-processor` and use `after()` from `next/server` to enqueue each job.

### Files to modify

- `src/components/onboarding/onboarding-step-credentials.tsx` — wait for `datos_personales` step before advancing
- `src/components/onboarding/onboarding-step-invoices.tsx` — pass `skipSiradigExtraction=true`, update step definitions
- `src/app/api/automatizacion/route.ts` — accept `skipSiradigExtraction` for PULL_COMPROBANTES
- `src/lib/automation/job-processor.ts` — check `skipSiradigExtraction` flag in PULL_COMPROBANTES flow
- `src/app/api/onboarding/complete/route.ts` — create background jobs after completion

## Out of Scope

- Changing the PULL_PROFILE job steps or parallelizing SiRADIG sections
- Showing progress indicators for post-onboarding background jobs on the dashboard
- Modifying the non-onboarding PULL_COMPROBANTES flow
- Changes to step 4 (submit first deduction)
- Retry logic for failed post-onboarding background jobs
