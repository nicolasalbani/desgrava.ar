# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desgrava.ar is a tax deduction automation platform for Argentine taxpayers. It helps users calculate tax savings, manage invoices (manual + OCR from PDFs), classify invoice categories with AI, and automatically submit deductions to ARCA/SiRADIG via browser automation.

## Working Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Bias toward caution over speed; for trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Exception:** autonomous skills (`/implement-loop`, `/fix-ticket`) run without a human in the loop. Inside those flows, pick the most defensible interpretation and proceed; record the assumption in the PR/commit body instead of blocking.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

**Exception:** the Testing mandate below (tests for every new `src/lib/` and `src/hooks/` module) overrides this rule — add the tests even when the user didn't explicitly ask.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For non-trivial multi-step tasks, use TodoWrite to track progress. A structured plan with explicit verification checks per step is valuable when work is genuinely multi-step, ambiguous, or high-stakes:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

For simple or obvious tasks, skip the formal plan and just do the work. Use judgment — don't ceremonially wrap a one-line fix in a verification plan.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Commands

| Command                                | Purpose                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                          | Start Next.js dev server                                   |
| `npm run build`                        | Production build                                           |
| `npm run start`                        | Start production server                                    |
| `npm run lint`                         | ESLint                                                     |
| `npm run test`                         | Run all tests (Vitest)                                     |
| `npm run test:watch`                   | Run tests in watch mode                                    |
| `npm run format`                       | Format all files with Prettier                             |
| `npm run format:check`                 | Check formatting (CI-friendly)                             |
| `npx prisma migrate dev --name <name>` | Create database migration                                  |
| `npx prisma generate`                  | Regenerate Prisma client (output: `src/generated/prisma/`) |

**CI validation** (run all before submitting work):

```bash
npm run lint && npm run format:check && npm run build && npm run test
```

## Tech Stack

Next.js 16 (App Router), TypeScript (strict), PostgreSQL via Prisma 7, NextAuth 4 (Google OAuth + Credentials + Prisma adapter), shadcn/ui + Tailwind CSS 4 + Radix UI, Playwright for browser automation, Tesseract.js + pdf-parse for OCR, OpenAI for AI-powered invoice category classification, Resend for transactional email, bcryptjs for password hashing, Embla Carousel for landing page reviews.

## Architecture

**Route groups** organize the app by access level:

- `(public)/` — unauthenticated pages (e.g., `/simulador`)
- `(auth)/` — login flow (Google OAuth + email/password), email verification, password reset
- `(dashboard)/` — protected routes, checked via `getServerSession()` in layout

**API routes** (`src/app/api/`) mirror domain structure: `/comprobantes`, `/credenciales`, `/automatizacion`, `/simulador/calcular`, `/configuracion`, `/perfil` (user profile: name + avatar image), `/trabajadores`, `/recibos`, `/presentaciones`, `/empleadores`, `/datos-personales`, `/cron/presentaciones`, `/cron/review-non-deductible`, `/subscription`, `/webhooks/mercadopago`, `/webhooks/telegram` (handles Telegram callback queries for catalog review approvals), `/cron/subscription-reminders`, `/soporte` (tickets + AI chat), `/tour/complete` and `/tour/replay` (sets/clears `User.tourSeenAt` for the post-onboarding dashboard tour). All protected routes validate `session?.user?.id`. Write routes (POST/PUT/DELETE) also check subscription access via `requireWriteAccess()` — returns 403 if subscription is expired.

**Business logic** lives in `src/lib/`, organized by domain:

- `simulador/` — Tax calculation engine with Argentine tax brackets, deduction rules, and Zod schemas
- `ocr/` — Document processing pipeline (pdf-parse first, Tesseract fallback) + field extraction
- `automation/` — Playwright-based ARCA/SiRADIG automation: job processor, browser pool, navigators, CSS selectors, deduction mapper
- `crypto/encryption.ts` — AES-256-GCM for ARCA credentials (encrypt/decrypt at API boundary)
- `email.ts` — Resend integration for verification and password reset emails
- `telegram.ts` — Telegram Bot API integration for group notifications (new user signups, support tickets)
- `rate-limit.ts` — In-memory rate limiter for auth endpoints
- `catalog/` — Global provider catalog: CUIT → deduction category lookup with sistemas360.ar enrichment, plus `review-non-deductible` daily batch that re-checks NO_DEDUCIBLE entries and proposes reclassifications for admin approval via Telegram inline buttons
- `telegram-callback.ts` — HMAC signing/parsing for Telegram inline-button `callback_data` (signed with `TELEGRAM_WEBHOOK_SECRET`)
- `validators/` — Zod schemas for invoices, credentials, CUIT format, domestic workers/receipts
- `domestic/` — Domestic workers domain logic (schemas, validators)
- `subscription/` — Subscription management: plans/pricing constants, access control (`resolveCanWrite`), trial creation
- `mercadopago/` — MercadoPago SDK integration: client init, preapproval (subscription) creation/cancellation, webhook processing
- `soporte/` — AI support chat: system prompt with app knowledge, OpenAI tool definitions for ticket creation and WhatsApp escalation
- `onboarding/` — Pure helpers for the post-onboarding dashboard tour: `progress-stages.ts` maps automation job steps to a 7-stage label list (connecting/invoices/employers/dependents/receipts/classifying/done), `aggregate-progress.ts` filters and aggregates the API job list per fiscal year into `{ snapshot, summary }`, `proximo-paso-state.ts` derives the "Próximo paso" card variant (7 branches, comprobantes-priority) from invoice/receipt counts, worker registration state, and import state

**UI components** (`src/components/`) are split by feature domain (`facturas/`, `recibos/`, `trabajadores/`, `automatizacion/`, `credenciales/`, `simulador/`, `presentaciones/`, `landing/`, `auth/`, `subscription/`, `soporte/`, `onboarding/`, `dashboard/`) with shared components in `shared/` (e.g., `JobStatusBadge`, `JobHistoryPanel`, `PaginationControls`), shadcn components in `ui/`, and layout components in `layout/`.

**Hooks** (`src/hooks/`) contain shared React hooks:

- `use-paginated-fetch` — Generic hook for server-side paginated data fetching with debounced search, filter management, and polling support. Used by `InvoiceList`, `ReceiptList`, and `PresentacionesList`.
- `use-arca-import-progress` — Polls `/api/automatizacion` every 4s and exposes `{ snapshot, summary }` derived from the post-onboarding ARCA imports (PULL_COMPROBANTES, PULL_DOMESTIC_RECEIPTS, PULL_PRESENTACIONES + leftover PULL_PROFILE). Single source of truth for the persistent ARCA progress strip and the disabled "Importar desde ARCA" button on the Próximo paso card. Stops polling once all tracked jobs are terminal.

## Key Patterns

- **All monetary calculations** use `Decimal.js` (never floating-point) for tax math precision.
- **ARCA credentials** are encrypted with AES-256-GCM, decrypted only on-demand for automation jobs, never kept in memory.
- **Automation jobs** are queued with status tracking (PENDING → RUNNING → COMPLETED/FAILED), real-time step-based progress. Job status is embedded inline in each invoice/receipt row (no separate page). Each row shows its latest job status and can expand to show full job history with step checklist. There is no retry — users re-send to create a fresh job. Jobs are audit records deleted only via cascade when the parent invoice/receipt is deleted. Step definitions live in `src/lib/automation/job-steps.ts` (`JOB_TYPE_STEPS`) — the single source of truth for all user-facing progress steps. Raw logs are still stored in the DB for debugging but never shown to users; the `StepProgress` component (`src/components/shared/step-progress.tsx`) renders the checklist UI. Screenshots and video recordings have been removed for performance — no artifacts are captured during automation. When multiple invoices are selected for submission, each creates an individual `SUBMIT_INVOICE` job. The browser pool supports up to 10 concurrent jobs (`MAX_CONCURRENT = 10`).
- **ARCA login** (`arca-navigator.ts`) uses `domcontentloaded` + explicit element waits (not `networkidle`) because ARCA's login pages have persistent connections that cause `networkidle` to hang, especially from remote servers. The ARCA portal and SiRADIG popup use `networkidle` for their `goto`/load since they are SPAs that render content via AJAX after the `load` event fires.
- **SiRADIG** is a single-page jQuery app. After the initial page load, all interactions are AJAX. Use `networkidle` for waits inside SiRADIG (it works because AJAX requests are finite), but never for ARCA login page navigation.
- **SiRADIG fiscal year cutoff**: After March 31st each year, the previous fiscal year is no longer accessible in SiRADIG. When only one fiscal year is available, SiRADIG auto-selects it and skips the period selection page entirely (URL goes straight to `determinarContribuyente.do?codigo=YYYY`). Automation code must handle this by making the period `<select>` step conditional — check if the selector appears within a short timeout, and skip if it doesn't. Between January 1st and March 31st, both the current and previous year are available, so the `<select>` will appear.
- **OCR pipeline** tries pdf-parse for text-based PDFs, falls back to Tesseract for scanned documents.
- **AI category classification** uses OpenAI to auto-detect invoice deduction categories when users upload or create invoices. The global `ProviderCatalog` table caches categories by CUIT — once a provider is classified, all users benefit. For unknown CUITs without PDF text, the system enriches classification context by fetching business activity data from `sistemas360.ar/cuit/{cuit}`. The `NO_DEDUCIBLE` category is system-internal: assigned by AI when a provider is clearly non-deductible (supermarkets, utilities, etc.), never user-selectable in forms, excluded from tax calculations, and blocked from SiRADIG submission. `DEDUCTION_CATEGORIES` is the user-facing subset; `ALL_DEDUCTION_CATEGORIES` includes `NO_DEDUCIBLE` for internal/AI use.
- **Invoice management** uses Dialog modals for upload and manual entry, with multi-select popover filters (categories, statuses) on the table view. Both facturas and recibos use server-side pagination via `usePaginatedFetch` — filtering, search, and pagination are handled by the API with Prisma `skip`/`take` and `count()` in parallel.
- **Credential validation** calls `/api/credenciales/validar` after saving to verify ARCA credentials work.
- **Path alias**: `@/*` maps to `./src/*`.
- **Naming**: Spanish names in ARCA/SiRADIG-specific automation code, English elsewhere.
- **Design**: Jony Ive-inspired — clean whites, `border-gray-200` borders, `bg-gray-50` content areas, generous whitespace, translucent navbar with backdrop blur. Consistent palette across landing page and dashboard.
- **Non-deductible CUIT review** runs daily via `/api/cron/review-non-deductible`, re-classifying up to 50 NO_DEDUCIBLE catalog entries per run with a fresh web lookup (sistemas360.ar → cuitonline.com) combined with aggregated invoice metadata from all users' NO_DEDUCIBLE invoices for that CUIT. Entries are skipped if reviewed in the last 30 days (`ProviderCatalog.lastReviewedAt`), if the provider name matches the hardcoded keyword list, or if an open `CatalogReviewProposal` already exists. Deductible results trigger a Telegram message with inline "✅ Aprobar / ❌ Rechazar" buttons. The admin's click hits `/api/webhooks/telegram`, which validates a `X-Telegram-Bot-Api-Secret-Token` header and verifies an HMAC on the `callback_data` (signed with `TELEGRAM_WEBHOOK_SECRET`). On approve, the catalog entry and every `NO_DEDUCIBLE` invoice with that CUIT are updated in a single transaction, and affected users receive a generic email linking to `/comprobantes`. The Telegram webhook must be registered once via `setWebhook` with the secret token — not automated.
- **Subscriptions** use MercadoPago's Preapproval (Suscripciones) API for recurring billing. New users get a 30-day trial (TRIALING), existing pre-launch users are FOUNDERS (permanent access). Access control: FOUNDERS always have write access; TRIALING/ACTIVE/CANCELLED (within period) can write; EXPIRED/PAST_DUE are read-only. Pricing lives in `src/lib/subscription/plans.ts` — single source of truth for landing page and checkout. Webhook at `/api/webhooks/mercadopago` syncs subscription state. Daily cron at `/api/cron/subscription-reminders` sends trial expiry emails and expires stale subscriptions.
- **Post-onboarding dashboard tour** auto-opens once for users with `onboardingCompleted=true` and `tourSeenAt=null`. The flow is: welcome modal (Ganancio character) → 4 spotlight steps targeting real DOM via `data-tour` attributes (`metrics-row` → `proximo-paso` → `comprobantes-recientes` → `nav-presentaciones` with mobile fallback `nav-presentaciones-mobile`) → completion modal with confetti and import summary. The spotlight overlay uses an SVG `<mask>` with a rounded-rect hole, re-measuring on resize/scroll/ResizeObserver and auto-scrolling the target into view. Targets are matched by `findVisibleTarget()` which iterates the candidate selectors and skips hidden elements. Skip / replay flow: `POST /api/tour/complete` sets `tourSeenAt = now()`; `POST /api/tour/replay` clears it. Replay button lives in the new "Ayuda" card on `/configuracion`.
- **ARCA progress strip** is mounted in `DashboardShell` so it sits above `<main>` on every dashboard route. It uses `useArcaImportProgress` (polls `/api/automatizacion`) and aggregates the post-onboarding ARCA imports into a 7-stage progress label + percentage. The strip auto-hides 5s after `done`, supports a collapsed floating-pill mode, and turns amber if any tracked job FAILS (linking to `/automatizacion`). All "Importar desde ARCA" buttons across the app — Próximo paso card on `/panel`, toolbar buttons on `/comprobantes` and `/recibos` — share the same `<ArcaImportButton>` component (`src/components/shared/arca-import-button.tsx`) which reads from the same hook so they stay in sync with the strip: clicking fires the job, the button shows a left-to-right progress fill while running, and the strip handles the rest of the feedback (no modal). The hook's `snapshot.completedTypes` lets list pages bump a `refreshKey` exactly once per completion transition (`PULL_COMPROBANTES` → refresh `/comprobantes`, `PULL_DOMESTIC_RECEIPTS` → refresh `/recibos`).
- **"Próximo paso" card** on `/panel` shows a contextual next action via a 7-branch state machine in `src/lib/onboarding/proximo-paso-state.ts`: importing → review-month → register-trabajador → review-recibos → no-invoices → ready-to-present → all-set. Comprobantes always take priority over recibos. Branches are pure-derivable from `pendingInvoiceCount`, `pendingReceiptCount`, `totalDeducibleInvoices`, `totalDeducibleReceipts`, `hasUnregisteredWorker`, `allSubmitted`, `hasRunningImport`, and `currentMonth`. CTAs either deep-link (e.g. `/comprobantes`, `/recibos`, `/trabajadores`, `/presentaciones`) or trigger a `PULL_COMPROBANTES` job through `POST /api/automatizacion`.
- **"Comprobantes recientes" section** on `/panel` shows the 5 most recent deducible invoices fetched in the dashboard server component (`prisma.invoice.findMany({ take: 5, orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }] })`). Mobile uses stacked card rows; tablet+ uses a row layout. Status badges follow the same color tokens as the rest of the app (`bg-emerald-500/10` for SUBMITTED, `bg-amber-500/10` for PENDING, etc.).

## Testing

**Framework**: Vitest with 920+ tests across 44 test files.

**Test location**: Tests live in `__tests__/` directories alongside their modules (e.g., `src/lib/simulador/__tests__/calculator.test.ts`).

**Covered modules**:

- `simulador/` — calculator, deduction-rules, tax-tables, schemas (125 tests)
- `validators/` — cuit, invoice, credentials (55 tests)
- `crypto/` — encryption round-trip and tamper detection (17 tests)
- `automation/` — deduction-mapper, selectors, presentacion selectors, job-steps, siradig-extractor (150 tests)
- `ocr/` — field-extractor, pipeline (22 tests)
- `catalog/` — provider-catalog HTML parser (8 tests)
- `ocr/` — receipt-extractor for domestic worker salary receipts (26 tests)
- `validators/` — domestic worker and receipt schemas (32 tests)
- `hooks/` — usePaginatedFetch buildParams helper (16 tests)
- `validators/` — password complexity rules, schemas (23 tests)
- `rate-limit` — in-memory rate limiter (5 tests)
- `subscription/` — plans constants, access control logic (22 tests)
- `soporte/` — system prompt content, tool definitions (incl. job type labels, failed automation lookup), types (22 tests)
- `email` — sendBugFixPREmail function (4 tests)
- `telegram` — Telegram Bot API notifications: formatting, env var handling, error handling (13 tests)
- `fiscal-year` — fiscal year read-only cutoff logic, available years (18 tests)
- `validators/` — profile update schema (12 tests)
- `onboarding/` — progress-stages aggregator, proximo-paso state machine, aggregate-progress filter+summary (41 tests)

**Writing new tests**: Always create tests for new `src/lib/` and `src/hooks/` modules. Place them in `__tests__/` alongside the module. Use `@/` path aliases. Run `npm run test` to validate.

## CI/CD & Deployment

**Hosting**: Fly.io in the `gru` (São Paulo) region. Config in `fly.toml`. VM: `performance-1x` (2GB RAM) for Playwright/Chromium automation.

**GitHub Actions** workflows:

- **CI** (`.github/workflows/ci.yml`) — runs on push/PR to main: lint, format check, build, test
- **Deploy** (`.github/workflows/deploy.yml`) — runs on push to main after CI passes: `flyctl deploy --remote-only`. Requires `FLY_API_TOKEN` GitHub secret.
- **Cron: Presentaciones** (`.github/workflows/cron-presentaciones.yml`) — daily at 08:00 UTC, POSTs to `/api/cron/presentaciones`
- **Cron: Subscription Reminders** (`.github/workflows/cron-subscription-reminders.yml`) — daily at 09:00 UTC, POSTs to `/api/cron/subscription-reminders`
- **Cron: Review non-deductible** (`.github/workflows/cron-review-non-deductible.yml`) — daily at 10:00 UTC, POSTs to `/api/cron/review-non-deductible`

Cron workflows require `PROD_API_URL` and `CRON_SECRET` GitHub secrets.

**Health check**: `/api/health` returns `{ status: "ok" }` — used by Fly.io HTTP checks.

**Pre-commit hooks** (husky + lint-staged): Prettier + ESLint auto-fix on staged `.ts/.tsx` files.

## Skills

Custom skills in `.claude/skills/`:

- `/new-feature <description>` — Full workflow: plan → implement → test → validate → document
- `/fix-bug <description>` — Investigate → fix → regression test → validate
- `/implement-loop <task>` — Autonomous loop: code until lint+format+build+test all pass (max 10 iterations). For ARCA/SiRADIG automation tasks, includes a live-testing loop: run job → check logs → observe with `agent-browser` → fix → retry.
- `/arca-assisted-navigation <flow>` — Record a live ARCA/SiRADIG browsing session, then generate Playwright automation code, tests, and docs. Auto-triggers when working on automation tasks.
- `/write-spec <description>` — Generate a feature spec grounded in the current project state. Reads `specs/_template.md`, understands architecture, asks clarifying questions, and writes to `specs/`. When the request mentions product, marketing, or pricing concepts (`onboarding`, `activation`, `retention`, `pricing`, `positioning`, `growth`, `acquisition`, `channel`, `PMF`, `landing`, `conversion`, etc.), the skill consults Lenny Rachitsky's MCP server (`https://mcp.lennysdata.com/mcp`, configured in `.mcp.json` as `lennys-data`) and cites Lenny-derived frameworks inline as `[Lenny: <framework>]`. The MCP is skipped for purely technical work and falls back gracefully on auth/network failure.
- `/fix-ticket [--env dev|prod]` — Scheduled bug fix agent: fetches open support tickets, classifies bugs via AI, fixes them with `/fix-bug`, creates `fix/<ticket-id>` branches and PRs, updates ticket status to `IN_PROGRESS`, and emails the developer.

## Acceptance Criteria

Feature specs live in `specs/` as markdown with YAML frontmatter. Use `specs/_template.md` as a starting point. Reference specs when using `/new-feature`: `/new-feature specs/my-feature.md`.

## Environment Variables

`DATABASE_URL`, `ENCRYPTION_KEY` (64-char hex), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY` (for verification/reset emails), `CRON_SECRET` (for cron endpoint auth), `MERCADOPAGO_ACCESS_TOKEN` (MercadoPago API key for subscriptions), `MERCADOPAGO_WEBHOOK_SECRET` (webhook signature validation), `SUPPORT_EMAIL` (email for new ticket notifications + bug fix PR notifications), `SUPPORT_WHATSAPP` (WhatsApp number for escalation, e.g. 5491112345678), `PROD_API_URL` (production API base URL for fix-ticket agent + cron workflows), `PROD_CRON_SECRET` (production CRON_SECRET for fix-ticket agent), `PROD_DATABASE_URL` (read-only prod DB connection string for fix-ticket agent to sync prod data locally), `FLY_API_TOKEN` (GitHub Actions secret for Fly.io deploys), `TELEGRAM_BOT_TOKEN` (optional, Telegram Bot API token for group notifications — notifications skipped when absent), `TELEGRAM_CHAT_ID` (optional, Telegram group chat ID for notifications), `TELEGRAM_WEBHOOK_SECRET` (optional, HMAC secret for signing Telegram inline-button `callback_data` and validating the `X-Telegram-Bot-Api-Secret-Token` header on `/api/webhooks/telegram` — required for the non-deductible catalog review flow), `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (optional, Umami Cloud website ID for analytics — script not loaded when absent), `NEXT_PUBLIC_UMAMI_URL` (optional, Umami instance URL — defaults to `https://cloud.umami.is`).
