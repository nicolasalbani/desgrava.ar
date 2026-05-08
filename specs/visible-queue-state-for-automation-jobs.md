---
title: Visible Queue State for Automation Jobs
status: implemented
priority: medium
---

## Summary

Today the persistent ARCA progress strip is import-only (`PULL_*`) and the per-row "Pendiente" badge is visually identical whether a worker is processing the job right now or whether it's queued behind a long-running import. When a user fires a second automation while one is already running — for example, clicking "Desgravar" on three comprobantes while `PULL_PROFILE` is at 27 % — there is no signal that the new jobs were accepted into a queue and will start once the current one finishes. The user is left guessing why the row stays grey for 40 seconds. This feature makes the queued state legible everywhere it surfaces: the global strip widens to cover every active automation type, the row badge replaces "Pendiente" with explicit "Esperando…" copy, and `/comprobantes`, `/recibos`, and `/presentaciones` get an inline banner above the list that explains why the queued items haven't started yet. No counters, no position numbers, no new controls — the goal is comprehension, not control.

## Acceptance Criteria

### Strip covers all active job types

- [ ] The persistent strip in `DashboardShell` becomes visible when **any** automation job for the current user is `PENDING` or `RUNNING`, not only the four tracked import types
- [ ] Per-job-type stage labels exist for every `JobType` so the strip's "stage" line reads naturally for the active job:
  - `PULL_COMPROBANTES` → "Trayendo comprobantes" (existing)
  - `PULL_DOMESTIC_RECEIPTS` → "Trayendo recibos" (existing)
  - `PULL_PRESENTACIONES` → "Trayendo presentaciones" (existing)
  - `PULL_PROFILE` → "Trayendo cargas de familia" (existing)
  - `SUBMIT_INVOICE` → "Desgravando comprobante"
  - `SUBMIT_DOMESTIC_DEDUCTION` → "Desgravando recibo"
  - `SUBMIT_PRESENTACION` → "Generando presentación"
  - `PUSH_FAMILY_DEPENDENTS` → "Cargando familiares en SiRADIG"
  - `BULK_SUBMIT` → "Desgravando comprobantes"
  - `VALIDATE_CREDENTIALS` → "Validando credenciales"
- [ ] Time-weighted percent in the strip continues to apply for `PULL_*` jobs (existing `JOB_STEP_DURATIONS`); for non-import job types where we do not have duration estimates the strip shows the running stage label and an indeterminate animated bar at the top edge instead of a numeric percent — copy switches from `"Trayendo tus datos en segundo plano… {n}%"` to `"Procesando en segundo plano…"`
- [ ] When **multiple** jobs are active for the same user, the strip surfaces the one currently `RUNNING` (the per-user lock guarantees ≤ 1 running at a time); if none is `RUNNING` and one is `PENDING` (the worker pool itself is saturated), the strip says "Esperando que un worker tome la automatización…" with the same indeterminate animation
- [ ] When at least one **other** non-running job exists in addition to the running one, the strip's secondary line appends a static hint: `"Tenés más automatizaciones esperando — empezarán cuando termine esta."` — no count, no list
- [ ] Existing strip states (collapsed pill, success banner with "Trajimos N comprobantes…", amber failure banner) are preserved unchanged
- [ ] Auto-hide rules are preserved: 8 s after `allDone`, never resurfaces success on page reload (`observedRunningRef` semantics)

### Per-row badge: "Esperando…" replaces "Pendiente"

- [ ] `JobStatusBadge` renames the `PENDING` label from `"Pendiente"` to `"Esperando"` across every surface (invoice list, receipt list, presentaciones list, history panel)
- [ ] The `PENDING` dot is animated with a gentle `animate-pulse` to match the visual weight of `RUNNING` (today only `RUNNING` pulses; this makes "yes, your job is being looked at" obvious for both states)
- [ ] `JobHistoryPanel` updates its `STATUS_CONFIG.PENDING.label` to the same `"Esperando"`
- [ ] The badge `title` attribute on PENDING reads `"En cola — empieza cuando termine la automatización actual"` so the hover tooltip explains the wait

### Inline banner on list pages

- [ ] A new `<QueuedJobsBanner>` component (`src/components/shared/queued-jobs-banner.tsx`) renders above the table on `/comprobantes`, `/recibos`, and `/presentaciones` whenever the user has at least one `PENDING` automation job whose latest run hasn't started yet **for an entity type that page surfaces** — i.e., `SUBMIT_INVOICE` / `BULK_SUBMIT` for `/comprobantes`, `SUBMIT_DOMESTIC_DEDUCTION` for `/recibos`, `SUBMIT_PRESENTACION` for `/presentaciones`
- [ ] Banner copy (no counts):
  - `/comprobantes`: `"Tenés comprobantes esperando ser desgravados. Empezarán cuando termine la automatización actual."`
  - `/recibos`: `"Tenés recibos esperando ser desgravados. Empezarán cuando termine la automatización actual."`
  - `/presentaciones`: `"Tenés presentaciones esperando ser enviadas. Empezarán cuando termine la automatización actual."`
- [ ] Banner uses the same neutral primary-tinted style as the strip (`bg-primary/[0.04] dark:bg-primary/10 border border-primary/15 text-foreground`), `Loader2` icon, `text-sm` body, `rounded-lg` panel, dismissible **only** by the queue draining (no close button)
- [ ] Banner disappears within one poll cycle (≤ 4 s) once every relevant `PENDING` job has transitioned out — no stale banner
- [ ] Banner is hidden when there is no running ARCA job ahead of it (i.e., the queued jobs are already being processed, not waiting); in that case the row badges + strip already convey progress

### Hook + aggregator

- [ ] `useArcaImportProgress` (or a thin sibling hook to keep concerns separate — see Technical Notes) exposes a new field `queueState: { hasAnyActive: boolean; runningJobType: JobType | null; hasQueuedWaiting: boolean; queuedJobTypes: ReadonlyArray<JobType> }` derived from the same `/api/automatizacion` response (no extra fetch)
  - `runningJobType` = the single `RUNNING` job's type (server enforces ≤ 1 per user)
  - `hasQueuedWaiting` = there is at least one `PENDING` job in addition to the running one (or with no running and the worker pool saturated)
  - `queuedJobTypes` = unique list of `PENDING` job types — used by the inline banner to decide whether to mount itself per page
- [ ] All non-tracked job types (everything outside `TRACKED_JOB_TYPES`) flow through this new field but **do not** affect the existing `snapshot.percent`, `snapshot.completedTypes`, `snapshot.runningTypes`, or `summary.{invoices,receipts,presentaciones}` — those keep their current import-only semantics so the strip's success banner and `ArcaImportButton` per-type fills are unaffected
- [ ] `aggregateImportProgress` is extended (or paired with a new pure helper `computeQueueState(jobs, fiscalYear)`) that reads the same `ApiJobLite[]` and returns `queueState`
- [ ] The aggregator returns a stable empty `queueState` (`{ hasAnyActive: false, runningJobType: null, hasQueuedWaiting: false, queuedJobTypes: [] }`) when there are no active jobs

### Strip rendering integration

- [ ] When `queueState.hasAnyActive` is true and `runningJobType` is **not** in `TRACKED_JOB_TYPES`, the strip renders in a "non-import" mode: stage label from the new label map, indeterminate top bar (CSS keyframes — a 30 % wide block sliding L→R every 1.5 s), no `{n}%` text in the secondary line, otherwise visually identical
- [ ] When `queueState.hasAnyActive` is true and `runningJobType` **is** in `TRACKED_JOB_TYPES`, the strip behaves exactly as today (time-weighted percent, etc.) plus the optional "más en cola" hint when `hasQueuedWaiting` is true
- [ ] The aria-label of the strip is updated to match the displayed copy in both modes so screen readers announce the right thing

### Mobile / responsive / a11y / dark mode

- [ ] Strip, badge, and banner render correctly on screens ≥ 320 px wide; banner is full-width with `px-4 py-3`, no horizontal overflow
- [ ] Banner uses semantic tokens (`bg-primary/[0.04] dark:bg-primary/10`, `text-foreground`, `border-primary/15`) — works in light + dark mode without raw hex
- [ ] Indeterminate progress animation respects `prefers-reduced-motion` (CSS media query falls back to a static 30 % fill)
- [ ] Strip's `role="status"` / `aria-live="polite"` continues to announce mode transitions; banner adds `role="status"` (polite) so screen readers get the queued message exactly once per session

### Tests

- [ ] `aggregate-progress.test.ts` adds cases for `computeQueueState`:
  - no jobs → `{ hasAnyActive: false, … }`
  - one running `SUBMIT_INVOICE`, nothing else → `runningJobType: "SUBMIT_INVOICE"`, `hasQueuedWaiting: false`
  - one running `PULL_PROFILE` + two `PENDING` `SUBMIT_INVOICE` → `runningJobType: "PULL_PROFILE"`, `hasQueuedWaiting: true`, `queuedJobTypes: ["SUBMIT_INVOICE"]`
  - zero running + two `PENDING` (worker saturation) → `runningJobType: null`, `hasQueuedWaiting: true`
  - completed jobs are ignored
- [ ] `progress-stages.test.ts` adds a label-resolution test confirming each non-import `JobType` produces the expected stage label
- [ ] No regressions in the existing 1000+ test suite — `import-only` snapshot fields stay unchanged for the existing fixtures

## Technical Notes

- **Why no counters**: the user explicitly chose lowest-friction copy ("just esperando"). Counters open a usability rabbit hole — "3 in queue" feels like a queue length the user can act on, but they can't (no cancel UI in this spec). Static reassurance copy ("hay más en cola") avoids implying control we aren't building.
- **Single source of truth**: keep all derivation in `src/lib/onboarding/aggregate-progress.ts` and the existing `useArcaImportProgress` hook so we don't have a second pubsub for the strip. The new `queueState` is a sibling field, not a replacement of the existing snapshot — this preserves the time-weighted-percent path for imports.
- **Separation from `TRACKED_JOB_TYPES`**: do not add `SUBMIT_*` / `PUSH_*` / `VALIDATE_CREDENTIALS` to `TRACKED_JOB_TYPES`. That set is used by `ArcaImportButton` to gate per-type running state and by `summary.{invoices,…}` to compute the success banner. Polluting it would break those flows. Instead, the strip checks `runningJobType in TRACKED_JOB_TYPES` to decide which rendering mode to use.
- **Indeterminate animation**: a single CSS class (`.bar-indeterminate`) added to `arca-progress-strip.tsx` styling, using `@keyframes` translate. Respect `@media (prefers-reduced-motion)` with a static fallback.
- **Per-user lock invariant**: server-side per-user Redis lock guarantees only one job per user is in `RUNNING` at a time. The aggregator can rely on this — `runningJobType` is a single value, not an array. If the invariant ever breaks, the aggregator falls back to "first by createdAt asc" deterministically.
- **`/perfil` & `/automatizacion`**: out of scope. `/perfil` already has its own per-section state via `useArcaImportProgress`; `/automatizacion` redirects to `/comprobantes` today.
- **Files modified**:
  - `src/components/layout/arca-progress-strip.tsx` — extend rendering for non-import running jobs and the "más en cola" secondary line; add indeterminate-bar CSS
  - `src/components/shared/job-status-badge.tsx` — relabel `PENDING`, add pulse + tooltip
  - `src/components/shared/job-history-panel.tsx` — relabel `PENDING`
  - `src/hooks/use-arca-import-progress.ts` — expose `queueState`
  - `src/lib/onboarding/aggregate-progress.ts` — add `computeQueueState` + plumb through
  - `src/lib/onboarding/progress-stages.ts` — add stage-label map for non-tracked job types (or move into a new `job-type-labels.ts` next to `job-steps.ts` if more natural)
  - `src/components/facturas/invoice-list.tsx` — mount `<QueuedJobsBanner>` above the table
  - `src/components/recibos/receipt-list.tsx` — same
  - `src/components/presentaciones/presentaciones-list.tsx` — same
- **Files created**:
  - `src/components/shared/queued-jobs-banner.tsx`
- **Files NOT touched**:
  - `src/app/api/automatizacion/route.ts` — existing GET response is sufficient (returns all 50 latest jobs with all types and statuses)
  - `prisma/schema.prisma` — no DB changes
  - `ArcaImportButton` — its per-type running state is unaffected
  - The Próximo paso card — its branches are derived from invoice/receipt counts, not job state

## Out of Scope

- Counters or queue position (e.g., "3 en cola", "2.º en la cola") — explicitly rejected in the clarifying questions
- Cancel-from-badge / cancel-from-banner controls — feedback only, no controls
- An expandable queue inspector listing every queued job with its entity name — feedback only
- Worker-pool-wide queue depth — only the user's own jobs are surfaced
- Time estimates ("about 30 s remaining") for non-import job types — no `JOB_STEP_DURATIONS` exist for `SUBMIT_*` / `PUSH_*` yet, and adding them is a separate spec
- A queued-jobs banner on `/perfil` — `/perfil` already shows per-section spinners during `PULL_PROFILE`; it does not surface user-triggered submit jobs
- Telemetry / event tracking on banner impressions or queue length — analytics is out of scope
- Changing the toast copy on enqueue (`"Comprobante desgravado"` etc.) — the new persistent surfaces (strip + banner + relabeled badge) carry the message; toast wording is a separate copywriting pass
- Re-architecting `TRACKED_JOB_TYPES` to be data-driven from `JOB_STEP_DURATIONS` — out of scope; the new label map is a flat addition
