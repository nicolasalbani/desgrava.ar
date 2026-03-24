---
title: Step-based automation feedback
status: implemented
priority: high
---

## Summary

Replace raw log output across all automation flows with a unified step-based progress UI. Instead of streaming technical log lines, the user sees a checklist of high-level steps (e.g., "Iniciando sesión en ARCA", "Importando comprobantes") where completed steps show a checkmark, the active step shows a spinner, and future steps are dimmed. This applies to import dialogs, submit dialogs, and the inline JobHistoryPanel in list rows — making feedback consistent and approachable across the entire app.

## Acceptance Criteria

### Step definitions per job type

- [ ] Each `JobType` has a predefined ordered list of high-level steps (3–6 steps max) defined in a single shared constant map (`JOB_TYPE_STEPS`)
- [ ] Steps are identified by a string key (e.g., `"login"`, `"navigate"`, `"download"`) and have a user-facing Spanish label
- [ ] Step definitions for each job type:
  - **VALIDATE_CREDENTIALS**: Iniciando sesión en ARCA → Verificando credenciales → Listo
  - **PULL_COMPROBANTES**: Iniciando sesión en ARCA → Descargando comprobantes → Clasificando proveedores → Guardando facturas → Listo
  - **PULL_FAMILY_DEPENDENTS**: Iniciando sesión en ARCA → Abriendo SiRADIG → Extrayendo cargas de familia → Listo
  - **PUSH_FAMILY_DEPENDENTS**: Iniciando sesión en ARCA → Abriendo SiRADIG → Cargando familiares → Listo
  - **SUBMIT_INVOICE**: Iniciando sesión en ARCA → Abriendo SiRADIG → Cargando deducción → Listo
  - **BULK_SUBMIT**: Iniciando sesión en ARCA → Abriendo SiRADIG → Cargando deducciones → Listo
  - **PULL_DOMESTIC_WORKERS**: Iniciando sesión en ARCA → Descargando personal doméstico → Guardando datos → Listo
  - **PULL_DOMESTIC_RECEIPTS**: Iniciando sesión en ARCA → Descargando recibos → Guardando recibos → Listo
  - **SUBMIT_DOMESTIC_DEDUCTION**: Iniciando sesión en ARCA → Abriendo SiRADIG → Cargando deducción → Listo
  - **PULL_PRESENTACIONES**: Iniciando sesión en ARCA → Abriendo SiRADIG → Descargando presentaciones → Listo
  - **SUBMIT_PRESENTACION**: Iniciando sesión en ARCA → Abriendo SiRADIG → Enviando presentación → Listo
- [ ] Step labels can be refined during implementation — the above are starting points, not final copy

### Server-side step progression

- [ ] A new `appendStep(jobId, stepKey, onLog)` function advances the current step for a job, alongside the existing `appendLog` (which continues to store detailed logs for debugging)
- [ ] Step progression is stored in a new `currentStep` field on the `AutomationJob` model (string, nullable — the key of the active step)
- [ ] The SSE `/api/automatizacion/[jobId]/logs` endpoint emits `step` events (e.g., `{ step: "download" }`) in addition to existing `log` events
- [ ] `appendStep` is called at the appropriate points in `job-processor.ts` and navigator files to advance through steps

### Shared StepProgress UI component

- [ ] A new `StepProgress` component (`src/components/shared/step-progress.tsx`) renders the step checklist
- [ ] Props: `steps: { key: string; label: string }[]`, `currentStep: string | null`, `status: JobStatus`, `errorMessage?: string | null`
- [ ] Visual states per step:
  - **Completed**: Green checkmark icon + normal text
  - **Active**: Blue spinner icon + slightly bold text
  - **Pending**: Gray circle icon + muted/dimmed text
  - **Failed**: Red X icon on the failed step + error message below it
- [ ] When `status` is `COMPLETED`, all steps show checkmarks
- [ ] When `status` is `FAILED`, steps up to the failed step show checkmarks, the failed step shows a red X, remaining steps stay dimmed
- [ ] Dark mode support via semantic tokens (`text-muted-foreground`, `bg-muted`, etc.) and paired `dark:` variants for colored states
- [ ] Compact layout: vertical list, no excessive whitespace — should fit comfortably in a dialog or inline panel

### Import dialogs (facturas, recibos, presentaciones)

- [ ] The `LogPanel` component is removed from all three import dialogs
- [ ] Replaced with `StepProgress` that updates in real-time via SSE `step` events
- [ ] The result summary grid (Encontrados, Importados, etc.) remains unchanged after completion
- [ ] Failed state shows the `StepProgress` with the failed step highlighted + error message, instead of raw logs
- [ ] Progress bar in facturas import dialog is kept (it's driven by result counts, not logs)

### Submit dialogs (presentaciones)

- [ ] `SubmitPresentacionDialog` replaces its log panel with `StepProgress`
- [ ] Same step progression via SSE

### JobHistoryPanel (inline in list rows)

- [ ] The `LogsContainer` (dark log box) inside `JobHistoryPanel` is replaced with `StepProgress`
- [ ] For completed/failed jobs, `StepProgress` is rendered from the stored `currentStep` + `status`
- [ ] Error messages continue to display below the failed step (replacing the current red alert box)

### Backward compatibility

- [ ] Jobs created before this change (no `currentStep` data) fall back to showing the final status only (completed checkmark or failed X) — no step breakdown, no raw logs
- [ ] Raw logs continue to be stored in the `AutomationJob.logs` field for debugging — they are simply not displayed to users
- [ ] The `/api/automatizacion/[jobId]` detail endpoint still returns logs for developer inspection

## Technical Notes

### Step definitions constant

Create `src/lib/automation/job-steps.ts` with:

```typescript
export const JOB_TYPE_STEPS: Record<string, { key: string; label: string }[]> = {
  VALIDATE_CREDENTIALS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "verify", label: "Verificando credenciales" },
    { key: "done", label: "Listo" },
  ],
  // ... etc
};
```

This is imported by both server (job-processor) and client (StepProgress) code.

### Database change

Add `currentStep String?` to the `AutomationJob` model in `prisma/schema.prisma`. This stores the key of the currently active step. No migration of existing data needed — null means "no step info available" (backward compat).

### appendStep integration

In `job-processor.ts`, call `appendStep(jobId, "login", onLog)` at the same points where you'd currently write a log like `"Iniciando sesión..."`. The function:

1. Updates the in-memory step state
2. Persists `currentStep` to DB
3. Fires the SSE callback with `{ step: stepKey }`

Existing `appendLog` calls remain unchanged — they continue writing to `logs` for debugging but are no longer surfaced in the UI.

### SSE protocol extension

The existing SSE stream at `/api/automatizacion/[jobId]/logs/route.ts` currently sends `{ log, status, screenshot, done }`. Add a `step` field: `{ step: "download", ... }`. The client watches for `step` events to advance the `StepProgress` component.

### StepProgress component design

Follow the app's Jony Ive design system. The checklist should be minimal:

- Use `lucide-react` icons: `Check` (completed), `Loader2` with `animate-spin` (active), `Circle` (pending), `X` (failed)
- Spacing: `space-y-2` or `space-y-3`, icons at 16px
- Text: `text-sm`, with `font-medium` for the active step

### Files to modify

- `prisma/schema.prisma` — Add `currentStep` field
- `src/lib/automation/job-steps.ts` — New: step definitions
- `src/lib/automation/job-processor.ts` — Add `appendStep`, call it at flow transitions
- `src/lib/automation/arca-navigator.ts` — Call `appendStep` for login step
- `src/lib/automation/siradig-navigator.ts` — Call `appendStep` for SiRADIG navigation steps
- `src/lib/automation/mis-comprobantes-navigator.ts` — Call `appendStep` for download steps
- `src/lib/automation/domestic-navigator.ts` — Call `appendStep` for domestic flow steps
- `src/lib/automation/presentacion-navigator.ts` — Call `appendStep` for presentacion flow steps
- `src/app/api/automatizacion/[jobId]/logs/route.ts` — Emit `step` events in SSE
- `src/components/shared/step-progress.tsx` — New: shared step UI component
- `src/components/shared/job-history-panel.tsx` — Replace LogsContainer with StepProgress
- `src/components/facturas/import-arca-dialog.tsx` — Replace LogPanel with StepProgress
- `src/components/recibos/import-arca-dialog.tsx` — Replace LogPanel with StepProgress
- `src/components/presentaciones/import-arca-dialog.tsx` — Replace LogPanel with StepProgress
- `src/components/presentaciones/submit-presentacion-dialog.tsx` — Replace log display with StepProgress

## Out of Scope

- Removing the `logs` field from the DB or API — logs are retained for developer debugging
- Per-step timing or duration display
- Step-level progress percentages (e.g., "Importing 50/200 invoices") — the existing progress bar in facturas import covers this
- Changes to the credential validation flow (it already doesn't show logs)
- Retry/cancel UX changes — those stay as-is
- Notification system for completed jobs
