---
title: Post-Onboarding Dashboard Tour with ARCA Progress Strip
status: implemented
priority: high
---

## Summary

After a user finishes the blocking guided onboarding flow, the dashboard kicks off three background ARCA imports (`PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES`) but offers no introduction to what's on the screen, no awareness that imports are still running, and no clear "next thing to do." This spec adds (a) a 5-beat first-visit tour — welcome modal → 4 spotlight steps on real DOM elements → completion modal with confetti — and (b) a persistent ARCA progress strip visible across all dashboard routes that shows the aggregated state of the post-onboarding background jobs. It also introduces a new "Próximo paso" card and a "Comprobantes recientes" section on the dashboard so the tour has real, useful targets to highlight.

## Acceptance Criteria

### Tour entry / replay

- [ ] A new field `tourSeenAt DateTime?` is added to the `User` model (no backfill — defaults to `null` for all existing and new users so everyone sees the tour once after this ships)
- [ ] When an authenticated user with `onboardingCompleted = true` and `tourSeenAt = null` lands on `/dashboard`, the welcome modal auto-opens
- [ ] Users with `tourSeenAt != null` never see the tour automatically
- [ ] The tour can be replayed at any time from a new "Ayuda" card on `/configuracion` via a "Volver a ver el tour" button — replaying clears `tourSeenAt` and navigates to `/dashboard` with the welcome modal open
- [ ] Skipping or completing the tour calls `POST /api/tour/complete` which sets `tourSeenAt = now()` so it doesn't reappear on the next visit

### Welcome modal (beat 1)

- [ ] Built on Radix Dialog (focus trap, Escape closes / treated as skip)
- [ ] Shows a "Ganancio" character illustration (the contador mascot) in the header
- [ ] Body copy introduces Ganancio and announces "Estamos trayendo tus datos de ARCA del año fiscal {fiscalYear}"
- [ ] Two CTAs: primary "Empezar tour", secondary "Saltar"
- [ ] "Saltar" sets `tourSeenAt = now()` and dismisses; "Empezar tour" advances to the first spotlight step

### Spotlight steps (beats 2–5: 4 steps total)

- [ ] Step targets are identified via `data-tour="..."` attributes on existing DOM:
  - Step 2 → `data-tour="metrics-row"` on the top metric cards container in `MetricsPanel`
  - Step 3 → `data-tour="proximo-paso"` on the new Próximo paso card
  - Step 4 → `data-tour="comprobantes-recientes"` on the new Comprobantes recientes section on `/dashboard`
  - Step 5 → `data-tour="nav-presentaciones"` on the "Presentaciones" sidebar nav item (with a parallel attribute on the corresponding `DashboardMobileNav` item)
- [ ] Each spotlight renders an SVG overlay with `<mask>` punching a rounded-rect hole around the target's bounding rect (~8px padding, ~12px border radius)
- [ ] On mount and on `resize` / `scroll` / `ResizeObserver` events, the hole re-measures the target rect and updates
- [ ] Before revealing each step, the target is auto-scrolled into view (`element.scrollIntoView({ block: "center", behavior: "smooth" })`)
- [ ] A floating tooltip card is positioned next to the hole with: title, body copy, prev/next/skip buttons, and progress dots (4 dots, current one filled)
- [ ] "Skip" sets `tourSeenAt = now()` and dismisses; "Next" on the last spotlight advances to the completion modal
- [ ] When a spotlight target is hidden on mobile (sidebar items), the spotlight retargets the corresponding mobile-nav item
- [ ] The overlay blocks clicks outside the hole (so the only interactive element is the tooltip itself)

### Completion modal (beat 6)

- [ ] Radix Dialog with confetti animation triggered on open (using existing `canvas-confetti` dep)
- [ ] If all 3 post-onboarding jobs (`PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES`) are in terminal state, body shows summary counts:
  - "{N} comprobantes importados" (link to `/facturas`)
  - "{N} recibos salariales importados" (link to `/recibos`)
  - "{N} presentaciones traídas" (link to `/presentaciones`)
- [ ] If any of the 3 jobs is still PENDING/RUNNING, body shows "Sigo trayendo el resto en segundo plano" with the current stage label
- [ ] Single CTA "Listo" closes and persists `tourSeenAt`

### ARCA progress strip (persistent background layer)

- [ ] A persistent strip is rendered at the top of `<main>` inside `DashboardShell` so it appears on every dashboard route (`/dashboard`, `/facturas`, `/recibos`, `/presentaciones`, `/perfil`, `/credenciales`, `/configuracion`)
- [ ] The strip is a client component that polls `/api/automatizacion` every 4s while any tracked job is PENDING/RUNNING and stops polling when all are terminal
- [ ] Stages are a fixed 7-step list mapped from the underlying job steps:
  - `connecting` (any job at `login`)
  - `invoices` (`PULL_COMPROBANTES.navigate_comprobantes` / `download`)
  - `employers` (leftover `PULL_PROFILE.empleadores` if a refresh during onboarding caught one mid-run)
  - `dependents` (leftover `PULL_PROFILE.cargas_familia`)
  - `receipts` (`PULL_DOMESTIC_RECEIPTS.download`)
  - `classifying` (`PULL_COMPROBANTES.classify`)
  - `done` (all terminal)
- [ ] Strip shows: a stage label ("Trayendo tus comprobantes…"), a percentage derived from completed-steps / total-steps across the tracked jobs, and a determinate progress bar
- [ ] Strip has a collapse button — when collapsed it becomes a floating pill in the bottom-right (similar to `SupportChatButton` placement) showing only the stage icon + %
- [ ] Strip auto-hides 5s after reaching `done`; the floating pill auto-hides immediately at `done`
- [ ] If any tracked job FAILS, the strip turns amber and shows "Hubo un problema con uno de los pasos" with a link to `/automatizacion` (no retry from the strip itself)
- [ ] When the user is mid-tour and the strip is behind the spotlight overlay, the strip remains visible but non-interactive

### Próximo paso card (new dashboard component)

- [ ] A new card is rendered on `/dashboard` between the metrics row and the stacked bar chart, with `data-tour="proximo-paso"`
- [ ] Card shows a "PRÓXIMO PASO" eyebrow label, a contextual title, supporting copy, and 1–2 action buttons (primary + optional secondary), matching the screenshot reference (rounded-2xl card, primary blue button, secondary outline button)
- [ ] State machine (priority order; first match wins):
  1. Any tracked import job is RUNNING → title "Estamos descargando tus datos de ARCA", body "Vuelvo en unos minutos con tus comprobantes y recibos.", "Importar desde ARCA" CTA shown but disabled with a determinate progress fill (see below)
  2. There are unsent deducible invoices for the current month or earlier → title "Revisá y presentá {currentMonthName}", body "{N} comprobantes esperan tu confirmación antes de presentarse a SiRADIG.", CTAs "Revisar comprobantes" → `/facturas` and "Importar desde ARCA" → triggers a manual `PULL_COMPROBANTES` job
  3. No deducible invoices for the current fiscal year exist → title "Importá tus comprobantes", body "Traé los comprobantes que ARCA tiene cargados a tu nombre.", CTA "Importar desde ARCA"
  4. All deducibles are SUBMITTED and we are inside the SiRADIG submission window → title "Presentá tu F.572 web", body "Ya enviaste tus deducciones. Confirmá la presentación en SiRADIG.", CTA "Ir a Presentaciones" → `/presentaciones`
  5. Otherwise → title "Todo al día", body "Te aviso cuando haya algo para hacer.", no CTAs
- [ ] When a `PULL_COMPROBANTES` job is already running, the "Importar desde ARCA" button is rendered in a disabled state with a left-to-right progress fill animation tied to the job's aggregated progress percentage (same value the ARCA progress strip uses). The button label switches to "Descargando…" while running.
- [ ] Counts and "current month" come from the same Prisma query already running in the dashboard server component (`monthCategoryBreakdown`, `pendingCount`); no additional round-trips
- [ ] The active "Importar desde ARCA" CTA POSTs to the existing `/api/automatizacion` route to enqueue a `PULL_COMPROBANTES` job, then refreshes the page to pick up the running state
- [ ] Card is keyboard-focusable; primary CTA is the first focusable element after the header

### Comprobantes recientes section (new dashboard component)

- [ ] A new "Comprobantes recientes" card is rendered on `/dashboard` below the stacked bar chart, with `data-tour="comprobantes-recientes"`
- [ ] Shows the 5 most recent invoices for the current fiscal year (sorted by `invoiceDate` descending), excluding `NO_DEDUCIBLE`
- [ ] Each row: provider name, category label, invoice date, amount, and SiRADIG status badge (reuse existing `JobStatusBadge` patterns where it fits)
- [ ] Header has a "Ver todos" link to `/facturas`
- [ ] Empty state: "Todavía no tenés comprobantes deducibles. Importalos desde ARCA o cargalos manualmente." with a CTA to `/facturas`
- [ ] Section data is fetched in the existing dashboard server component (a single new `prisma.invoice.findMany({ take: 5 })` call) and passed to the client `MetricsPanel` (or a new sibling client component composed by `dashboard/page.tsx`)

### Configuración → Ayuda card

- [ ] A new "Ayuda" card is appended to `/configuracion` after the existing cards (profile, email-ingest, auto-submit, subscription)
- [ ] Card contains a single row: label "Tour de bienvenida" + button "Volver a ver el tour"
- [ ] Clicking the button hits `POST /api/tour/replay` which sets `tourSeenAt = null`, then router-navigates to `/dashboard`
- [ ] Card follows the same Jony Ive styling as the other configuracion cards

### Mobile / responsive

- [ ] All new UI works on screens as narrow as 320px
- [ ] Welcome and completion modals are full-bleed sheets on mobile (`max-w-full sm:max-w-md`), centered card on desktop
- [ ] Spotlight tooltips reposition to fit within the viewport on mobile (anchored to top/bottom edge instead of side when the target is too wide)
- [ ] ARCA progress strip stacks label + bar vertically on mobile; the floating pill is a 44px tap target
- [ ] Próximo paso card stacks CTAs vertically on screens narrower than `sm`
- [ ] Comprobantes recientes section uses card-style stacked rows on mobile (no horizontal table) and a 4-column row on `sm:` and up
- [ ] Touch targets on tooltip prev/next/skip buttons are ≥44px

### Accessibility & dark mode

- [ ] All new UI uses semantic tokens (`bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`) so it works in both themes
- [ ] Modals trap focus, restore focus on close, and respond to Escape (treated as skip)
- [ ] Spotlight tooltip has `role="dialog"` with `aria-labelledby` / `aria-describedby` and traps focus while open
- [ ] Progress strip uses `role="status"` with `aria-live="polite"` and an `aria-label` describing the current stage
- [ ] The disabled "Importar desde ARCA" button has `aria-disabled="true"` and `aria-valuenow` reflecting the progress percentage

## Technical Notes

### DB & API

- **Prisma**: add `tourSeenAt DateTime?` to `User`. No data migration — `null` is the default, which is the desired "show tour" state for everyone after this ships.
- **`POST /api/tour/complete`**: sets `tourSeenAt = new Date()` for the session user. Idempotent.
- **`POST /api/tour/replay`**: sets `tourSeenAt = null` for the session user. Both routes validate `session?.user?.id` and skip the `requireWriteAccess()` gate (these are UX preferences, not write-billed actions — match the pattern used by `/api/configuracion`).
- **Layout passthrough**: `src/app/(dashboard)/layout.tsx` already selects `onboardingCompleted` from the User row — extend the select to include `tourSeenAt` and pass it into `DashboardShell`. Pass it through to a new `DashboardTour` client component that mounts only when `onboardingCompleted && tourSeenAt === null`.

### Components

- **`src/components/onboarding/dashboard-tour.tsx`** (new): orchestrator that owns the welcome modal, spotlight stepper, and completion modal. Uses Radix `Dialog` for modals. Uses `canvas-confetti` (already installed) on completion.
- **`src/components/onboarding/spotlight.tsx`** (new): full-viewport `fixed inset-0 z-[60]` SVG overlay with a `<mask>` containing a `<rect fill="white">` (visible) and a per-target `<rect fill="black" rx>` (hole). Uses `getBoundingClientRect()` and a `ResizeObserver` + `scroll`/`resize` listeners to keep the hole synced. Tooltip rendered as a sibling absolutely-positioned div using a small placement helper (no need for `@floating-ui` — placement is bounded to 4 known targets).
- **`src/components/dashboard/proximo-paso-card.tsx`** (new): pure render based on props. Server component composes props in `dashboard/page.tsx`.
- **`src/components/dashboard/comprobantes-recientes.tsx`** (new): server-data + client-render section showing the 5 most recent invoices. Reuses category labels via `CATEGORY_LABELS`.
- **`src/components/layout/arca-progress-strip.tsx`** (new): client component, mounted from `DashboardShell` so it sits above `<main>`. Polls `/api/automatizacion` (existing endpoint — `MetricsPanel` already polls it on a 4s interval; reuse the same cadence). State machine for the 7 stages lives in `src/lib/onboarding/progress-stages.ts` (new) so it's unit-testable.
- **`src/components/configuracion/ayuda-card.tsx`** (new): single button that POSTs to `/api/tour/replay` and uses `router.push("/dashboard")`. Match existing card styling from `profile-card.tsx`.
- **`data-tour` attributes**: add to `MetricsPanel`, the new Próximo paso card, the new Comprobantes recientes section, `DashboardSidebar`, and `DashboardMobileNav`.

### Stage aggregation logic

- Tracked job types: `PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES` (post-onboarding); plus `PULL_PROFILE` if a leftover one is still RUNNING.
- For each tracked job, look up its step definitions from `JOB_TYPE_STEPS` in `src/lib/automation/job-steps.ts` and the latest reported step from the job's `currentStep` field.
- Map each underlying step to one of the 7 high-level stages; aggregate progress as `Σ completed steps / Σ total steps` across all tracked jobs of the current fiscal year.
- Stage label shown to the user is the highest in-flight stage (most-recent active job's mapped stage). Stages with nothing mapped to them in the current run are silently skipped from the visible label sequence.
- The same aggregated percentage feeds both the ARCA progress strip and the Próximo paso card's disabled-button progress fill — single source of truth via a shared hook (`useArcaImportProgress` in `src/hooks/use-arca-import-progress.ts`) so they stay in sync.

### Mobile-first

- Design at 320px first; enhance with `sm:` / `md:` / `lg:`. Modals use full-bleed sheet layout on mobile (`max-w-full inset-x-2 sm:inset-x-auto sm:max-w-md`). Spotlight tooltip clamps to the viewport with `max-w-[calc(100vw-2rem)]`. Próximo paso card uses `flex-col sm:flex-row` for CTAs. Comprobantes recientes uses stacked card rows on mobile.

### Tests

- `src/lib/onboarding/__tests__/progress-stages.test.ts` — given a set of `AutomationJob` rows with various step states, asserts the right aggregated stage and percentage are returned (covers all 7 stages, including "leftover PULL_PROFILE", "all done", and "one job FAILED").
- `src/lib/onboarding/__tests__/proximo-paso-state.test.ts` — pure helper that takes invoice counts + job states and returns the card variant; table-driven over all 5 branches.
- `src/hooks/__tests__/use-arca-import-progress.test.ts` — verifies that the hook polls only while jobs are active, stops when all terminal, and exposes the same percentage to multiple consumers.

## Out of Scope

- Re-running the post-onboarding background jobs from inside the tour (existing dashboard CTAs handle this)
- Telemetry/analytics on tour completion or step-by-step funnel beyond the `tourSeenAt` timestamp
- Localizing tour copy beyond Spanish
- A second-time tour for later product features (this is just the dashboard intro)
- Confetti / animation on the welcome modal (only the completion modal)
- Persistent collapsed-pill preference across sessions (collapse state is in-memory / per-page-load)
- Pausing or cancelling background ARCA jobs from the strip
- Showing the strip on landing/auth/public routes — it only appears inside `(dashboard)/`
- Pagination, filtering, or editing on the Comprobantes recientes section — it's a fixed top-5 read-only preview that links to `/facturas`
- Adding a "Próximo paso" card variant for users with no SiRADIG cycle yet open (covered by branch 5 — generic "Todo al día")
