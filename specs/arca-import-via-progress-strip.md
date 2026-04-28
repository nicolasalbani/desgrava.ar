---
title: ARCA Import via Progress Strip (Replace Modals)
status: implemented
priority: medium
---

## Summary

The "Importar desde ARCA" button on `/facturas` and `/recibos` opens a blocking modal that duplicates the persistent ARCA progress strip already mounted on every dashboard route. The strip was built for the post-onboarding background imports and handles every state we need (running, done, failed, collapsed, summary), so the modal adds friction without adding information. This spec removes both modals and routes the import through the strip: clicking the toolbar button enqueues the job, the strip surfaces progress at the top of the screen, and the user keeps interacting with the list view instead of being trapped in a dialog.

## Acceptance Criteria

### Trigger flow

- [ ] Clicking "Importar desde ARCA" on `/facturas` POSTs directly to `/api/automatizacion` to enqueue a `PULL_COMPROBANTES` job for the current fiscal year — no modal opens
- [ ] Clicking "Importar desde ARCA" on `/recibos` does the same for `PULL_DOMESTIC_RECEIPTS`
- [ ] While the relevant job is `PENDING` or `RUNNING`, the toolbar button enters a disabled state with a left-to-right progress fill matching the existing Próximo paso card button (label switches to "Descargando…")
- [ ] If a job of the relevant type is already running when the button is clicked, the API's existing dedup logic prevents a duplicate; the UI shows the same disabled-with-progress state without any error
- [ ] The persistent ARCA progress strip becomes visible at the top of the page as soon as the job is enqueued (existing `useArcaImportProgress` polling already handles this)
- [ ] No confirmation modal, no inline step list, no result modal — all visual feedback happens through the strip

### List auto-refresh on completion

- [ ] When `PULL_COMPROBANTES` transitions from RUNNING to COMPLETED, the `InvoiceList` on `/facturas` reloads its data without requiring page navigation or manual refresh
- [ ] When `PULL_DOMESTIC_RECEIPTS` transitions to COMPLETED, the `ReceiptList` on `/recibos` reloads
- [ ] The refresh triggers exactly once per completion event (no duplicate fetches if the user navigates between tabs)
- [ ] If the user is on `/facturas` and `PULL_DOMESTIC_RECEIPTS` completes (or vice versa), no spurious refresh fires
- [ ] Failures: the strip's existing amber banner handles error display via the link to `/automatizacion`; the list view does not show an inline error

### Code cleanup

- [ ] `src/components/facturas/import-arca-dialog.tsx` is deleted
- [ ] `src/components/recibos/import-arca-dialog.tsx` is deleted
- [ ] `src/app/(dashboard)/facturas/page.tsx` no longer imports `ImportArcaDialog`; the `importArcaOpen` state and `setImportArcaOpen` setter are removed; the toolbar button `onClick` switches to the new direct-fire handler
- [ ] `src/app/(dashboard)/recibos/page.tsx` no longer imports `ImportArcaReceiptsDialog`; same state cleanup; same `onClick` rewire
- [ ] If `family-dependents.tsx` is the only remaining consumer of the `skippedArcaDialogs` `UserPreference` field, leave the field in place — only confirm via grep, do not preemptively delete the schema field in this spec
- [ ] No remaining import or reference to the deleted dialogs anywhere in `src/`
- [ ] `npm run lint && npm run format:check && npm run build && npm run test` all pass

### Hook / progress-aggregator extension

- [ ] `useArcaImportProgress` exposes a way for consumers to react to per-type completion. Two acceptable shapes:
  - (a) extend the snapshot with `completedTypes: ReadonlyArray<JobType>` (the set of tracked jobs currently in COMPLETED status) so consumers can diff against the previous render in a `useEffect`, **OR**
  - (b) accept an optional `onJobCompleted?: (jobType: JobType) => void` callback that fires once per completion transition
- [ ] `aggregate-progress.test.ts` covers whichever option is chosen with at least 3 cases: no-completions, single-type completion, multi-type completion in the same poll cycle
- [ ] The new signal does not change the strip's existing behavior or visual states

### Reusable button component

- [ ] A small shared component `ArcaImportButton` (location: `src/components/shared/arca-import-button.tsx`) renders the disabled-with-progress-fill state. It takes a `jobType` prop (`PULL_COMPROBANTES` | `PULL_DOMESTIC_RECEIPTS`), reads the relevant percent and running state from `useArcaImportProgress`, fires the enqueue POST on click, and disables itself while running
- [ ] The Próximo paso card's "Importar desde ARCA" button is migrated to use this component, replacing its current ad-hoc implementation, so the same disabled-with-fill animation lives in one place
- [ ] Visual diff vs. the current Próximo paso button is intentional only if necessary to make the toolbar button fit; otherwise pixel-equivalent

### Mobile / responsive / a11y / dark mode

- [ ] The toolbar buttons on `/facturas` and `/recibos` continue to render and be tappable on screens as narrow as 320px (≥44px touch target, no overflow)
- [ ] Dark mode works via semantic tokens; the progress fill uses `bg-primary` on a `bg-primary/10` track to match the existing Próximo paso card
- [ ] The button has `aria-disabled="true"` and `aria-valuenow={percent}` while running, matching the existing pattern
- [ ] The strip's existing `role="status"` / `aria-live="polite"` already announces progress; no additional announcement needed from the toolbar button

## Technical Notes

- **Existing pattern reuse**: the Próximo paso card already implements click-to-fire-`PULL_COMPROBANTES` + disabled-with-progress-fill (per the post-onboarding-dashboard-tour spec). Extract that into `ArcaImportButton` and reuse on three sites: dashboard Próximo paso, `/facturas` toolbar, `/recibos` toolbar.
- **Job enqueue endpoint**: `POST /api/automatizacion` is the existing route. Confirm it already prevents duplicate active jobs of the same type (it does — dedup is implemented for the `MAX_CONCURRENT = 10` browser pool); if the dedup returns a 409 or "existing job" response, treat the click as a no-op.
- **Refresh mechanism**: the cleanest implementation is option (a) above — extend the snapshot returned by `aggregateImportProgress` with `completedTypes: ReadonlyArray<JobType>`. The list pages subscribe to the hook, store the previous `completedTypes` in a ref, and bump `refreshKey` (or call `mutate()` on the paginated fetcher) when the relevant type appears in `completedTypes` for the first time. This avoids any callback-prop plumbing.
- **`skippedArcaDialogs` cleanup**: the field was used by `import-arca-dialog.tsx` to remember "no preguntes más". Search for remaining consumers (`family-dependents.tsx` may still use it). If anything still reads the field, leave it; otherwise it is safe to drop in a follow-up spec, but **do not** drop it in this PR — keep the change surgical.
- **Files modified**:
  - `src/app/(dashboard)/facturas/page.tsx` — drop modal import + state, wire toolbar button to `ArcaImportButton`, listen for `PULL_COMPROBANTES` completion via the hook
  - `src/app/(dashboard)/recibos/page.tsx` — same for `PULL_DOMESTIC_RECEIPTS`
  - `src/hooks/use-arca-import-progress.ts` — expose `completedTypes` from the snapshot
  - `src/lib/onboarding/aggregate-progress.ts` — derive `completedTypes` from the job list
  - `src/lib/onboarding/__tests__/aggregate-progress.test.ts` — add cases for `completedTypes`
  - `src/components/dashboard/proximo-paso-card.tsx` — migrate its button to `ArcaImportButton`
- **Files created**:
  - `src/components/shared/arca-import-button.tsx`
- **Files deleted**:
  - `src/components/facturas/import-arca-dialog.tsx`
  - `src/components/recibos/import-arca-dialog.tsx`
- **Files explicitly NOT touched**:
  - `src/components/presentaciones/import-arca-dialog.tsx` (out of scope per the user's request)
  - `src/components/layout/arca-progress-strip.tsx` (no behavior change needed)
  - The strip's auto-hide / collapse / failed states — all reused as-is
- **Mobile-first**: all the affected surfaces already work mobile-first. The new button matches existing toolbar button sizing (`min-h-[44px]` from shadcn defaults).
- **No DB changes**: no Prisma migration. `UserPreference.skippedArcaDialogs` may become orphan in a follow-up if `family-dependents.tsx` doesn't use it, but that cleanup is out of scope.
- **No new business logic in `src/lib/automation/`**: the job processor and step list are unchanged.

## Out of Scope

- The `/presentaciones` import dialog (user limited scope to comprobantes + recibos)
- Removing the `skippedArcaDialogs` `UserPreference` field or its API surface
- Changing the persistent ARCA progress strip's visual design, polling cadence, or summary copy
- Adding pause / cancel / retry controls to the strip or the new button
- Per-page mini-strip variants — the strip stays mounted in `DashboardShell`
- Touching the upload-by-PDF, email-ingest, or manual-entry flows on `/facturas` and `/recibos`
- Adding analytics for the new button or the import completion event
- Migrating any other ad-hoc "Importar desde ARCA" buttons not explicitly listed (the only three are dashboard Próximo paso, `/facturas`, `/recibos`)
- Refactoring `usePaginatedFetch` itself to support external invalidation events (the page-level `refreshKey` bump is enough)
