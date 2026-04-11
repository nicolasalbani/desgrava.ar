---
title: Optimize Automation Speed
status: implemented
priority: high
---

## Summary

Automation jobs are slower than necessary due to three main factors: (1) every automation action takes and saves screenshots + records video, adding I/O overhead per step; (2) operations that could run in parallel (DB reads, field extractions, upserts) run sequentially; (3) the browser pool only allows 1 concurrent job across all users. This spec removes all screenshot/video artifacts, parallelizes I/O within every automation flow and each PULL_PROFILE onboarding step, and increases browser pool concurrency to 10. Multiple invoice submissions use individual SUBMIT_INVOICE jobs that run concurrently via the expanded browser pool.

## Acceptance Criteria

### 1. Remove screenshots and video recordings

- [ ] All `onScreenshot` callback invocations are removed from every navigator and job-processor function
- [ ] Video recording is disabled: `getContext()` is never called with `recordVideoDir`
- [ ] `ensureVideoDir()` and `finalizeVideo()` calls are removed from the job processor main flow
- [ ] The `artifact-manager.ts` module is deleted entirely (screenshot save/read/list, video save/read/list, job dir management)
- [ ] The SSE stream at `/api/automatizacion/[jobId]/logs/route.ts` no longer sends `screenshot` events or `videoUrls` in the terminal payload
- [ ] The artifacts API route (`/api/automatizacion/[jobId]/artifacts/[filename]/route.ts`) is deleted
- [ ] The `onScreenshot` parameter is removed from all navigator function signatures (`loginToArca`, `navigateToSiradig`, `navigateToDeductionSection`, `fillDeductionForm`, `submitDeduction`, `navigateToCargasFamilia`, `extractCargasFamilia`, `pushCargasFamilia`, `pullDomesticReceipts`, `pullDomesticWorkersOnly`, `pullPresentaciones`, `submitPresentacion`, `confirmDatosPersonalesIfNeeded`, and all `process*` functions in job-processor)
- [ ] The `ScreenshotCallback` type export from `arca-navigator.ts` is removed
- [ ] The `stepCounter` variable and screenshot-related log entries (`"Screenshot: ..."`) are removed from the job processor
- [ ] `clearJobArtifacts` import/usage is removed from `clearJobLogs`
- [ ] All existing tests pass after removal

### 2. Parallelize I/O within automation flows

- [ ] In `processPullPersonalData`: all 9 `readField()` calls run via `Promise.all` instead of sequentially
- [ ] In `processPullProfile` step 2 (datos personales): all 9 `readField()` calls run via `Promise.all`
- [ ] In `processPullProfile` step 3 (employers): each employer's 5 field reads (`cuit`, `razonSocial`, `fechaInicio`, `fechaFin`, `agenteRetencion`) run via `Promise.all`
- [ ] In `processPullProfile` step 3 (employers): all employer DB upserts run via `Promise.all` after extraction is complete (batch upsert)
- [ ] In `processPullProfile` step 4 (cargas familia): DB upserts for all dependents run via `Promise.all` (or `createMany` where applicable)
- [ ] In `processPullProfile` step 5 (casas particulares): worker DB upserts run via `Promise.all`
- [ ] In `upsertFamilyDependents`: the loop of findFirst+create/update per dependent is replaced with parallel upserts using `Promise.all` with a concurrency limit
- [ ] In the main `processJob` function: credential decryption and browser context creation run in parallel (`Promise.all([decrypt(...), getContext(...)])`)
- [ ] All parallelized operations maintain the same behavior: same data written, same error handling, same status updates
- [ ] All existing tests pass after parallelization

### 3. Increase browser pool concurrency

- [ ] `MAX_CONCURRENT` in `browser-pool.ts` is increased from 1 to 10
- [ ] Multiple users' automation jobs can now run simultaneously instead of queueing behind each other
- [ ] Each user still gets their own `BrowserContext` (existing `contextMap` per userId is unchanged)
- [ ] The Fly.io `performance-1x` VM (2GB RAM) can handle the increased concurrency — Chromium contexts share a single browser process, so memory overhead per context is ~50-100MB, well within 2GB for 10 concurrent contexts

### 4. Reduce unnecessary waits

- [ ] `waitForTimeout` calls that exist solely to wait for screenshots to be taken are removed (since screenshots are gone)
- [ ] `waitForTimeout` calls that wait for content already validated by a subsequent `waitFor`/`waitForLoadState` are removed or reduced
- [ ] No `waitForTimeout` calls are removed without understanding their purpose — animation waits, AJAX settle waits, and SiRADIG jQuery timing waits must be preserved

## Technical Notes

### Screenshot/video removal approach

The removal is straightforward: delete `artifact-manager.ts`, delete the artifacts API route, then work through every file that imports from either. The `onScreenshot` parameter threading goes through: `job-processor.ts` → `arca-navigator.ts`, `siradig-navigator.ts`, `mis-comprobantes-navigator.ts`, `domestic-navigator.ts`, `presentacion-navigator.ts`. Remove the parameter from every function signature, every call site, and every `page.screenshot()` call within these files. In `browser-pool.ts`, remove the `recordVideoDir` option from `getContext` (always create context without video). The `ContextOptions` type and related code can be removed.

### Parallelization details

**Field reads**: Playwright `$eval` calls are independent when reading different selectors on the same page. They can safely run in parallel via `Promise.all`. Example in `processPullPersonalData`:

```typescript
const [apellido, nombre, dirCalle, dirNro, dirPiso, dirDpto, descProvincia, localidad, codPostal] =
  await Promise.all([
    readField(sel.formApellido),
    readField(sel.formNombre),
    readField(sel.formDirCalle),
    readField(sel.formDirNro),
    readField(sel.formDirPiso),
    readField(sel.formDirDpto),
    readField(sel.formDescProvincia),
    readField(sel.formLocalidad),
    readField(sel.formCodPostal),
  ]);
```

**DB upserts**: After extracting all data from the browser, DB writes are independent and can run in parallel. Use `Promise.all` with chunking (e.g., 10 at a time) to avoid overwhelming the connection pool.

**Credential decrypt + browser init**: `decrypt()` is CPU-bound (AES-256-GCM) and `getContext()` may launch the browser. These are independent and can overlap.

### Browser pool concurrency

Changing `MAX_CONCURRENT` from 1 to 10 in `browser-pool.ts` (line 4). The `PQueue` instance already supports configurable concurrency — this is a single constant change. All contexts share the same Chromium browser process launched by `ensureBrowser()`, so the overhead is per-context (~50-100MB) not per-browser. With 2GB RAM on the Fly.io VM, 10 concurrent contexts are feasible. If memory becomes a concern, this can be tuned down later.

### Files to modify

- **Delete**: `src/lib/automation/artifact-manager.ts`, `src/app/api/automatizacion/[jobId]/artifacts/[filename]/route.ts`
- **Major changes**: `src/lib/automation/job-processor.ts` (remove screenshots, parallelize I/O), `src/lib/automation/browser-pool.ts` (remove video recording options, increase MAX_CONCURRENT to 10)
- **Remove onScreenshot parameter**: `src/lib/automation/arca-navigator.ts`, `src/lib/automation/siradig-navigator.ts`, `src/lib/automation/mis-comprobantes-navigator.ts`, `src/lib/automation/domestic-navigator.ts`, `src/lib/automation/presentacion-navigator.ts`
- **SSE/API**: `src/app/api/automatizacion/[jobId]/logs/route.ts` (remove screenshot/video events)
- **Tests**: Update `src/lib/automation/__tests__/job-steps.test.ts`

## Out of Scope

- Reducing `waitForTimeout` values in SiRADIG navigation (too risky without live testing — SiRADIG's jQuery animations need specific timing)
- Parallelizing browser interactions within a single page (SiRADIG is a jQuery SPA — actions are inherently sequential)
- Changes to the onboarding step structure (steps 1–4 remain the same, only internal parallelism within each step)
- Changes to `PULL_COMPROBANTES` import parallelization (already optimized per existing spec `optimize-arca-import-performance.md`)
