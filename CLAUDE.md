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

Next.js 16 (App Router), TypeScript (strict), PostgreSQL via Prisma 7, NextAuth 4 (Google OAuth + Credentials + Prisma adapter), shadcn/ui + Tailwind CSS 4 + Radix UI, Playwright for browser automation, Tesseract.js + unpdf (serverless-compatible pdfjs build) for OCR, OpenAI for AI-powered invoice category classification, Resend for transactional email, bcryptjs for password hashing, Embla Carousel for landing page reviews.

## Architecture

**Route groups** organize the app by access level:

- `(public)/` — unauthenticated pages: `/simulador` (SEO landing for the savings calculator with H1, intro copy, "¿Cómo funciona?" content, FAQ block + JSON-LD `FAQPage` schema, and CTA), `/como-funciona` (dedicated SEO page mounting `<HowItWorksSection>` + `<FeaturesBento>` + `<LandingFaq>` plus expanded prose), `/planes` (dedicated SEO page mounting `<PricingSection>` + new `<PricingFaq>` plus expanded prose), `/quienes-somos` (footer-only About page: mission paragraph + 2-person team grid for Nicolás Albani + Nicolás Barbolla, photos in `public/images/team/<slug>.jpg` overwriting the committed placeholder), `/blog` (MDX blog index + `/blog/[slug]` post pages), `/terminos`, `/privacidad`, `/cookies`. The blog also exposes `/blog/rss.xml` (RSS 2.0 feed, route handler outside the `(public)` group).
- `(auth)/` — login flow (Google OAuth + email/password), email verification, password reset
- `(dashboard)/` — protected routes, checked via `getServerSession()` in layout

**API routes** (`src/app/api/`) mirror domain structure: `/comprobantes`, `/credenciales`, `/automatizacion`, `/simulador/calcular`, `/configuracion`, `/perfil` (user profile: name + avatar image), `/trabajadores`, `/recibos`, `/presentaciones`, `/empleadores`, `/datos-personales`, `/cron/presentaciones`, `/cron/review-non-deductible`, `/subscription`, `/webhooks/mercadopago`, `/webhooks/telegram` (handles Telegram callback queries for catalog review approvals), `/cron/subscription-reminders`, `/soporte` (tickets + AI chat), `/soporte/conversaciones` and `/soporte/conversaciones/[id]` (list/detail of the user's persisted Ganancio chats), `/tour/complete` and `/tour/replay` (sets/clears `User.tourSeenAt` for the post-onboarding dashboard tour). All protected routes validate `session?.user?.id`. Write routes (POST/PUT/DELETE) also check subscription access via `requireWriteAccess()` — returns 403 if subscription is expired.

**Business logic** lives in `src/lib/`, organized by domain:

- `simulador/` — Tax calculation engine with Argentine tax brackets, deduction rules, Zod schemas, the 6-category UI config (`category-config.ts`: keys, colors/hues, slider range, icon mapping), and persona presets (`personas.ts`: pre-filled examples for the landing simulator). `tax-tables.ts` exports `FISCAL_YEAR_DISPLAY` for SEO/UI labels separately from the active `CURRENT_PERIOD` (so we can label the year as 2026 while still computing with `TAX_TABLES_2025` until ARCA publishes new tables).
- `ocr/` — Document processing pipeline (unpdf text extraction first, Tesseract fallback for scanned PDFs / images) + field extraction. The pdfjs path uses `unpdf`'s `getDocumentProxy` (serverless-compatible) — the previous direct `pdfjs-dist` import broke on Vercel because it requires DOMMatrix/ImageData/Path2D polyfills via `@napi-rs/canvas`, which Vercel's bundler dropped.
- `automation/` — Playwright-based ARCA/SiRADIG automation: job processor, browser pool, navigators, CSS selectors, deduction mapper
- `queue/` — Redis-backed job queue. `redis-queue.ts` exposes `publishJob` (LPUSH from Vercel API routes), `consumeJob` (BRPOP from the worker pool), and per-user distributed locks (`acquireUserLock` / `releaseUserLock` / `extendUserLock`). The release/extend operations use Lua so a worker that times out can never accidentally release another worker's lock. A single `REDIS_URL` env var is required on every host (Vercel and every worker); the module fails loudly if it isn't set. **Local dev**: `npm run dev` runs `scripts/check-redis.mjs` which boots a daemonized `redis-server` (`brew install redis`) on port 6379 with data in `.redisdata/` — the dev `.env` ships pointing at `redis://localhost:6379`. Mirrors the Postgres pattern (`scripts/check-db.mjs` + `.pgdata/`). To swap dev to cloud Redis, comment the localhost line and uncomment the Upstash line in `.env`.
- `storage/` — Supabase Storage wrapper for the private `comprobantes` bucket. `supabase-storage.ts` exposes `uploadFile`, `getSignedUrl` (default 60s TTL), `downloadFile`, `deleteFile`, and pure helpers `buildStorageKey(userId, recordId, ext)` + `inferExtension(filename, mimeType)`. All file blobs live in Storage, never inline in Postgres — `Invoice.fileStorageKey`, `DomesticReceipt.fileStorageKey`, and `Presentacion.fileStorageKey` are `<userId>/<recordId>.<ext>` paths inside the bucket. Service-role access only; the bucket is private. Uploads happen AFTER the row exists (so the storage key can include the row id); on upload failure the row is rolled back for new inserts. Deletes are best-effort and don't block the row delete. File-serve API routes (`/api/comprobantes/[id]/file`, `/api/recibos/[id]/file`, `/api/presentaciones/[id]/pdf`) auth-check the user, then 302-redirect to a 60-second signed URL — bandwidth bypasses Vercel. **Local dev**: when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset, every method dispatches to `local-fs-storage.ts` instead — blobs live at `.storage/comprobantes/<key>`, signed URLs point at the catch-all route `/api/storage/[...key]/route.ts` and are HMAC-signed (SHA-256 over `key + "\n" + expires`) using `NEXTAUTH_SECRET`. Mirrors the brew-managed Postgres + Redis pattern. `STORAGE_BUCKET` is hard-coded to `comprobantes` in both drivers (single bucket today).
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
- `soporte/` — AI support chat ("Ganancio"): system prompt with app knowledge, OpenAI tool definitions for ticket creation and WhatsApp escalation, plus `conversation-title.ts` (pure `shouldGenerateTitle` helper + fire-and-forget `generateConversationTitle` that asks gpt-4o-mini for a 4–6 word Spanish title once a chat reaches 4 messages)
- `onboarding/` — Pure helpers for the post-onboarding dashboard tour: `progress-stages.ts` maps automation job steps to a 7-stage label list (connecting/invoices/employers/dependents/receipts/classifying/done), `aggregate-progress.ts` filters and aggregates the API job list per fiscal year into `{ snapshot, summary }`, `proximo-paso-state.ts` derives the "Próximo paso" card variant (7 branches, comprobantes-priority) from invoice/receipt counts, worker registration state, and import state
- `blog/` — File-based MDX blog. `schema.ts` (Zod frontmatter schema: slug/title/description/date/author + optional ogTitle/ogDescription) and `posts.ts` (`getAllPosts`, `getPostBySlug`, `formatBlogDate`). Posts live as `.mdx` files in `content/blog/` at the repo root (not under `src/`). Rendering uses `next-mdx-remote/rsc` from `src/app/(public)/blog/[slug]/page.tsx`; custom MDX components are exported from `mdx-components.tsx` at the project root (`mdxComponents` const + the `useMDXComponents` Next convention). Slugs are statically generated via `generateStaticParams`, the sitemap and `/blog/rss.xml` route both read from `getAllPosts()`. New posts: drop a frontmatter-validated `.mdx` into `content/blog/`, no code changes needed.

**UI components** (`src/components/`) are split by feature domain (`facturas/`, `recibos/`, `trabajadores/`, `automatizacion/`, `credenciales/`, `simulador/`, `presentaciones/`, `landing/`, `auth/`, `subscription/`, `soporte/`, `onboarding/`, `dashboard/`, `blog/`) with shared components in `shared/` (e.g., `JobStatusBadge`, `JobHistoryPanel`, `PaginationControls`), shadcn components in `ui/`, and layout components in `layout/`.

**Hooks** (`src/hooks/`) contain shared React hooks:

- `use-paginated-fetch` — Generic hook for server-side paginated data fetching with debounced search, filter management, and polling support. Used by `InvoiceList`, `ReceiptList`, and `PresentacionesList`.
- `use-arca-import-progress` — Polls `/api/automatizacion` every 4s and exposes `{ snapshot, summary, queueState }` derived from the post-onboarding ARCA imports (PULL*COMPROBANTES, PULL_DOMESTIC_RECEIPTS, PULL_PRESENTACIONES + leftover PULL_PROFILE). Single source of truth for the persistent ARCA progress strip and the disabled "Importar desde ARCA" button on the Próximo paso card. `queueState` (`computeQueueState` in `src/lib/onboarding/aggregate-progress.ts`) covers **all** job types — not just tracked imports — so the strip can also surface SUBMIT*\_/PUSH\_\_/VALIDATE_CREDENTIALS jobs (label resolved via `JOB_TYPE_LABELS` in `progress-stages.ts`) and the inline `<QueuedJobsBanner>` (`src/components/shared/queued-jobs-banner.tsx`, mounted on `/comprobantes`, `/recibos`, `/presentaciones`) knows when the user has pending submissions waiting behind a running automation. Stops polling once both snapshot and queueState are terminal. **The hook pauses polling when nothing is active** — to wake it after creating a job, always go through `enqueueAutomationJob(url, body?)` (exported from the same module). It POSTs the request, calls `refreshArcaProgress()` on `res.ok`, and returns the `Response` for the caller to consume. This is the single contract for any client-side request that creates a job (`/api/automatizacion`, `/api/presentaciones/enviar`, `/api/credenciales/validar`); raw `fetch` to those endpoints is a foot-gun that leaves the strip idle.
- `use-conversation` — Backs the Ganancio support chat. Hosted at `SupportChatButton` so state survives panel close/reopen. Owns `{ conversationId, messages, conversations, send, startNewConversation, loadConversation, refreshConversations }` with optimistic appends + rollback. `send` posts `{ message, conversationId, pageUrl }` to `/api/soporte/chat`; the server is the canonical store of the message history (the client only mirrors it).

## Key Patterns

- **All monetary calculations** use `Decimal.js` (never floating-point) for tax math precision.
- **ARCA credentials** are encrypted with AES-256-GCM, decrypted only on-demand for automation jobs, never kept in memory.
- **Automation jobs** are queued with status tracking (PENDING → RUNNING → COMPLETED/FAILED), step-based progress. Job status is embedded inline in each invoice/receipt row (no separate page). Each row shows its latest job status and can expand to show full job history with step checklist. There is no retry — users re-send to create a fresh job. Jobs are audit records deleted only via cascade when the parent invoice/receipt is deleted. Step definitions live in `src/lib/automation/job-steps.ts` (`JOB_TYPE_STEPS`) — the single source of truth for all user-facing progress steps. Raw logs are still stored in the DB for debugging but never shown to users; the `StepProgress` component (`src/components/shared/step-progress.tsx`) renders the checklist UI. Screenshots and video recordings have been removed for performance — no artifacts are captured during automation. When multiple invoices are selected for submission, each creates an individual `SUBMIT_INVOICE` job. The browser pool inside a worker supports up to 10 concurrent jobs (`MAX_CONCURRENT = 10`).
- **Job dispatch is pull-based via Redis**, not in-process `after()`. Vercel API routes call `publishJob(jobId)` (`LPUSH desgrava:jobs:queue`) and return; the worker pool runs `BRPOP` and dispatches each `jobId` to `processJob` from `src/lib/automation/job-processor.ts`. The worker entrypoint lives in [worker/index.ts](worker/index.ts) — a long-running Node process built on the official Playwright Docker image (see [worker/Dockerfile](worker/Dockerfile) and [worker/README.md](worker/README.md)). Per-user serialization is enforced by a Redis distributed lock keyed by `userId` (token-stamped `SET NX EX`, Lua `GET-then-DEL` release, periodic heartbeat to extend the TTL). If a worker can't acquire the lock it re-publishes the `jobId` with a small backoff. Workers handle `SIGTERM`/`SIGINT` by stopping `BRPOP`, draining in-flight jobs for up to 30s, then exiting. Multiple workers (any mix of Fly + self-hosted) compete for the same queue safely. Progress is observed by the UI via polling `/api/automatizacion/[jobId]` (see `useJobStatus` in [src/hooks/use-job-status.ts](src/hooks/use-job-status.ts)) — the legacy SSE log stream has been removed.
- **ARCA login** (`arca-navigator.ts`) uses `domcontentloaded` + explicit element waits (not `networkidle`) because ARCA's login pages have persistent connections that cause `networkidle` to hang, especially from remote servers. The ARCA portal and SiRADIG popup use `networkidle` for their `goto`/load since they are SPAs that render content via AJAX after the `load` event fires.
- **SiRADIG** is a single-page jQuery app. After the initial page load, all interactions are AJAX. Use `networkidle` for waits inside SiRADIG (it works because AJAX requests are finite), but never for ARCA login page navigation.
- **SiRADIG fiscal year cutoff**: After March 31st each year, the previous fiscal year is no longer accessible in SiRADIG. When only one fiscal year is available, SiRADIG auto-selects it and skips the period selection page entirely (URL goes straight to `determinarContribuyente.do?codigo=YYYY`). Automation code must handle this by making the period `<select>` step conditional — check if the selector appears within a short timeout, and skip if it doesn't. Between January 1st and March 31st, both the current and previous year are available, so the `<select>` will appear.
- **OCR pipeline** tries `unpdf` (serverless-compatible pdfjs build) for text-based PDFs, falls back to Tesseract for scanned documents. Tesseract is **skipped on Vercel** (its worker thread does a relative `require('..')` that Vercel's lambda bundler doesn't include — the crash escapes try/catch); on Vercel, scanned PDFs surface a Spanish hint asking the user to upload as JPG/PNG. The worker pool (Docker) keeps the full Tesseract path.
- **AI category classification** uses OpenAI to auto-detect invoice deduction categories when users upload or create invoices. The global `ProviderCatalog` table caches categories by CUIT — once a provider is classified, all users benefit. For unknown CUITs without PDF text, the system enriches classification context by fetching business activity data from `sistemas360.ar/cuit/{cuit}`. The `NO_DEDUCIBLE` category is system-internal: assigned by AI when a provider is clearly non-deductible (supermarkets, utilities, etc.), never user-selectable in forms, excluded from tax calculations, and blocked from SiRADIG submission. `DEDUCTION_CATEGORIES` is the user-facing subset; `ALL_DEDUCTION_CATEGORIES` includes `NO_DEDUCIBLE` for internal/AI use.
- **Invoice management** uses Dialog modals for upload and manual entry, with multi-select popover filters (categories, statuses) on the table view. Both facturas and recibos use server-side pagination via `usePaginatedFetch` — filtering, search, and pagination are handled by the API with Prisma `skip`/`take` and `count()` in parallel.
- **Credential validation** calls `/api/credenciales/validar` after saving to verify ARCA credentials work.
- **Path alias**: `@/*` maps to `./src/*`.
- **Naming**: Spanish names in ARCA/SiRADIG-specific automation code, English elsewhere.
- **Design**: Jony Ive-inspired — clean whites, `border-gray-200` borders, `bg-gray-50` content areas, generous whitespace, translucent navbar with backdrop blur. Consistent palette across landing page and dashboard.
- **Non-deductible CUIT review** runs daily via `/api/cron/review-non-deductible`, re-classifying up to 50 NO_DEDUCIBLE catalog entries per run with a fresh web lookup (sistemas360.ar → cuitonline.com) combined with aggregated invoice metadata from all users' NO_DEDUCIBLE invoices for that CUIT. Entries are skipped if reviewed in the last 30 days (`ProviderCatalog.lastReviewedAt`), if the provider name matches the hardcoded keyword list, or if an open `CatalogReviewProposal` already exists. Deductible results trigger a Telegram message with inline "✅ Aprobar / ❌ Rechazar" buttons. The admin's click hits `/api/webhooks/telegram`, which validates a `X-Telegram-Bot-Api-Secret-Token` header and verifies an HMAC on the `callback_data` (signed with `TELEGRAM_WEBHOOK_SECRET`). On approve, the catalog entry and every `NO_DEDUCIBLE` invoice with that CUIT are updated in a single transaction, and affected users receive a generic email linking to `/comprobantes`. The Telegram webhook must be registered once via `setWebhook` with the secret token — not automated.
- **Subscriptions** use MercadoPago's Preapproval (Suscripciones) API for recurring billing. New users get a 30-day trial (TRIALING), existing pre-launch users are FOUNDERS (permanent access). Access control: FOUNDERS always have write access; TRIALING/ACTIVE/CANCELLED (within period) can write; EXPIRED/PAST_DUE are read-only. Pricing lives in `src/lib/subscription/plans.ts` — single source of truth for landing page and checkout. Webhook at `/api/webhooks/mercadopago` syncs subscription state. Daily cron at `/api/cron/subscription-reminders` sends trial expiry emails and expires stale subscriptions.
- **Post-onboarding dashboard tour** auto-opens once for users with `onboardingCompleted=true` and `tourSeenAt=null`. The flow is: welcome modal (Ganancio character) → 4 spotlight steps targeting real DOM via `data-tour` attributes (`metrics-row` → `proximo-paso` → `comprobantes-recientes` → `nav-presentaciones` with mobile fallback `nav-presentaciones-mobile`) → completion modal with confetti and import summary. The spotlight overlay uses an SVG `<mask>` with a rounded-rect hole, re-measuring on resize/scroll/ResizeObserver and auto-scrolling the target into view. Targets are matched by `findVisibleTarget()` which iterates the candidate selectors and skips hidden elements. Skip / replay flow: `POST /api/tour/complete` sets `tourSeenAt = now()`; `POST /api/tour/replay` clears it. Replay button lives in the new "Ayuda" card on `/configuracion`.
- **ARCA progress strip** is mounted in `DashboardShell` so it sits above `<main>` on every dashboard route. It uses `useArcaImportProgress` (polls `/api/automatizacion` every 4s, plus a 1s client-side re-derive while a job is running) and aggregates the post-onboarding ARCA imports into a 7-stage progress label + percentage. The strip auto-hides 5s after `done`, supports a collapsed floating-pill mode, and turns amber if any tracked job FAILS (linking to `/automatizacion`). When the only active automation is **non-import** (SUBMIT*\*/PUSH*\*/VALIDATE_CREDENTIALS), the strip switches to "indeterminate mode": label from `JOB_TYPE_LABELS`, the thin top bar uses the `.bar-indeterminate` CSS keyframe (sliding 30% block, respects `prefers-reduced-motion`), secondary copy reads "Procesando en segundo plano…" instead of "{n}%". When the user has more PENDING jobs queued behind the running one (`queueState.hasQueuedWaiting`), the strip appends "Tenés más automatizaciones esperando — empezarán cuando termine esta." to the secondary line. The per-row `JobStatusBadge` and `JobHistoryPanel` show `PENDING` as "Esperando" with an animated amber dot and a `title` tooltip explaining the wait. All "Importar desde ARCA" buttons across the app — Próximo paso card on `/panel`, toolbar buttons on `/comprobantes`, `/recibos`, `/presentaciones`, and the "Importar todo desde ARCA" button on `/perfil` — share the same `<ArcaImportButton>` component (`src/components/shared/arca-import-button.tsx`) which reads from the same hook so they stay in sync with the strip: clicking fires the job, the button shows a left-to-right progress fill while running, and the strip handles the rest of the feedback (no modal). The hook's `snapshot.completedTypes` lets list pages bump a `refreshKey` exactly once per completion transition (`PULL_COMPROBANTES` → refresh `/comprobantes`, `PULL_DOMESTIC_RECEIPTS` → refresh `/recibos`, `PULL_PRESENTACIONES` → refresh `/presentaciones`, `PULL_PROFILE` → refresh perfil sections); `snapshot.runningTypes` scopes per-button running state when multiple imports run concurrently. **Progress is time-weighted**: percent comes from `Σ completed weight / Σ total weight` using `JOB_STEP_DURATIONS` (per-step expected seconds) in `src/lib/automation/job-steps.ts`, plus an in-flight partial slice of the current step (capped at 90% of the step's duration). Each `currentStep` advance writes `AutomationJob.currentStepStartedAt` so the aggregator can compute elapsed-step time from wall clock. This avoids the old "60% in 1s, then stuck" behavior of step-index percent. **Session cutoff**: the hook tracks `cutoffRef` and locks it to the earliest active job's `createdAt` on every transition into "active" state, then filters cached jobs to that cutoff before aggregation — without this, a user with previously-completed imports would see the strip start a new session at ~80% (because old completed jobs would dominate the weight). `pickSessionCutoff` and `filterJobsBySessionCutoff` in `aggregate-progress.ts` are the testable helpers.
- **"Próximo paso" card** on `/panel` shows a contextual next action via a 7-branch state machine in `src/lib/onboarding/proximo-paso-state.ts`: importing → review-month → register-trabajador → review-recibos → no-invoices → ready-to-present → all-set. Comprobantes always take priority over recibos. Branches are pure-derivable from `pendingInvoiceCount`, `pendingReceiptCount`, `totalDeducibleInvoices`, `totalDeducibleReceipts`, `hasUnregisteredWorker`, `allSubmitted`, `hasRunningImport`, and `currentMonth`. CTAs either deep-link (e.g. `/comprobantes`, `/recibos`, `/trabajadores`, `/presentaciones`) or trigger a `PULL_COMPROBANTES` job through `POST /api/automatizacion`.
- **Landing simulator** (`src/components/simulador/simulador-form.tsx`) is a fully client-side calculator with sliders + persona presets. Layout is two-column on `md+` (left = inputs, right = sticky `<aside>` with the full results panel) and single-column on mobile (sticky hero card on top + sticky bottom CTA). State lives in `SimuladorForm`; the same `SimplifiedSimulationResult` is fed to `<SimuladorResults>` (desktop full panel), `<SimuladorMobileHero>`, and `<SimuladorMobileCta>`. Persona presets in `src/lib/simulador/personas.ts` overwrite all values when selected; default is `familia-tipo` so the page opens with a populated result. Slider step is $1k, range $0–$10M/mes for all 6 categories. Per-category color hues + icon mapping live in `src/lib/simulador/category-config.ts`. The dedicated SEO page at `/simulador` embeds the same form plus an H1, intro, "¿Cómo funciona?" section, FAQ accordion (`src/components/landing/simulador-faq.tsx`) with `FAQPage` JSON-LD via `<Script type="application/ld+json">`, and a final CTA. The homepage hero "Calculá tu ahorro" button links to `/simulador` (the homepage's `#simulador` section still renders the same form for users who scroll). Sitemap at `src/app/sitemap.ts` includes `/`, `/simulador`, `/como-funciona`, `/planes`, `/blog`, `/terminos`, `/privacidad`, `/cookies`. Navbar entries (`src/lib/landing/section-links.ts`) carry both `anchorHref` (used on `/`, scroll-to-section) and `pageHref` (used on every other page, hard-link to dedicated `/como-funciona` / `/simulador` / `/planes`); footer always uses `pageHref`.
- **SEO hygiene** is centralized: `src/app/robots.ts` emits `/robots.txt` (allows `/`, disallows `/api/` and every dashboard/auth-private path, points at `/sitemap.xml`); `src/components/seo/site-jsonld.tsx` emits site-wide `Organization` + `WebSite` JSON-LD from the root layout (no `SearchAction` — the site has no internal search yet); `/como-funciona` emits a `HowTo` JSON-LD inline (id `como-funciona-howto-jsonld`); `/blog/[slug]` emits a `BreadcrumbList` JSON-LD next to its `Article` schema. New JSON-LD blocks are inline `<script type="application/ld+json">` (rendered in initial HTML, not `next/script` `afterInteractive`) so non-JS-executing crawlers see them. `src/app/sitemap.ts` uses stable `lastModified` values: `SITE_LAST_BUILT` constant captured at module load for marketing pages, max post date for `/blog`, per-post date for posts, hardcoded `LAST_LEGAL_UPDATE` for legal pages — Google ignores `<lastmod>` that changes on every fetch. Auth pages that should not be indexed (`/forgot-password`, `/reset-password`, `/verify-email`) export `metadata: { robots: { index: false, follow: false } }` (server-component pages with a separate `*-form.tsx` client component). `/login` stays indexable as a brand entry point. Every public page has explicit `alternates.canonical`, `openGraph`, and `twitter` blocks; the homepage emits all three (previously inherited from the root layout).
- **FAQ accordion** is a shared component (`src/components/landing/faq-accordion.tsx`) that renders a `<details>`-based accordion plus a `FAQPage` JSON-LD `<Script>` from a typed `items: { q, a }[]` dataset. Three surfaces consume it: `<SimuladorFaq>` on `/simulador` (8 calculation-focused questions, `jsonLdId="simulador-faq-jsonld"`), `<LandingFaq>` on `/como-funciona` (7 conversion-focused questions: security, autónomos vs. dependencia, employer/ARCA visibility, devolución timing, cancellation, vs. contador, partial-failure handling — `jsonLdId="landing-faq-jsonld"`), and `<PricingFaq>` on `/planes` (7 billing-focused questions: trial duration, no-card sign-up, cancellation, annual discount, payment methods, data retention, plan changes — `jsonLdId="planes-faq-jsonld"`). The home page does **not** mount any FAQ — the LandingFaq lives on `/como-funciona` instead so the dedicated SEO surface owns the schema and the home stays focused on flow. Each surface owns its own `<h2>` and dataset; the shared accordion guarantees DOM and JSON-LD stay in sync. To add a fourth surface, mount `<FaqAccordion>` with a unique `jsonLdId` per page (Google penalizes duplicate `FAQPage` schemas on the same URL).
- **"Comprobantes recientes" section** on `/panel` shows the 5 most recent deducible invoices fetched in the dashboard server component (`prisma.invoice.findMany({ take: 5, orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }] })`). Mobile uses stacked card rows; tablet+ uses a row layout. Status badges follow the same color tokens as the rest of the app (`bg-emerald-500/10` for SUBMITTED, `bg-amber-500/10` for PENDING, etc.).
- **Support chat (Ganancio)** persists every chat as a `SupportConversation` row (`messages` JSON, `title?` AI-generated after 4 turns, `lastMessageAt` indexed). The server is the canonical store — `POST /api/soporte/chat` accepts `{ message, conversationId? }` and on each turn loads/creates the conversation, runs OpenAI with the last 40 turns of stored history (older turns stay in the DB but drop from the model context), persists user+assistant messages atomically, and returns `{ conversationId, content, events }`. Tickets escalate from a conversation 1:1 via `SupportTicket.conversationId @unique` — calling `create_ticket` on a conversation that already has one returns `success: false` with a "iniciá una nueva conversación" message that the system prompt instructs Ganancio to surface. The chat panel header has a list/back icon that toggles to a `ConversationsList` view (sorted by `lastMessageAt`, ticket badge when present, relative-date labels via `Intl.RelativeTimeFormat`) and a `+` icon to start a new chat. The `useConversation` hook is hosted at `SupportChatButton` so the active `conversationId` survives close/reopen of the panel; full page reload starts a fresh session. Greeting is client-rendered with the session's first name: `"Hola {firstName}, soy Ganancio, tu asistente de desgrava.ar..."`. Bot avatar is `/ganancio.png` rendered through `<GanancioAvatar size>` (used in message bubbles and the typing indicator); the floating launcher keeps a generic lucide icon.

## Testing

**Framework**: Vitest with 1000+ tests across 50 test files.

**Test location**: Tests live in `__tests__/` directories alongside their modules (e.g., `src/lib/simulador/__tests__/calculator.test.ts`).

**Covered modules**:

- `simulador/` — calculator, deduction-rules, tax-tables, schemas, personas (138 tests)
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
- `soporte/` — system prompt content (incl. Ganancio identity + duplicate-ticket guardrail), tool definitions, conversation-title helper, types (29 tests)
- `email` — sendBugFixPREmail function (4 tests)
- `telegram` — Telegram Bot API notifications: formatting, env var handling, error handling (13 tests)
- `fiscal-year` — fiscal year read-only cutoff logic, available years (18 tests)
- `validators/` — profile update schema (12 tests)
- `onboarding/` — progress-stages aggregator (time-weighted percent), proximo-paso state machine, aggregate-progress filter+summary (61 tests)
- `blog/` — frontmatter Zod schema and posts loader (16 tests)

**Writing new tests**: Always create tests for new `src/lib/` and `src/hooks/` modules. Place them in `__tests__/` alongside the module. Use `@/` path aliases. Run `npm run test` to validate.

## CI/CD & Deployment

**Hosting split**:

- **Next.js app** → Vercel (auto-deploys from git push to `main` via Vercel's git integration; no GitHub Actions step required).
- **Worker pool** → Fly.io in the `gru` (São Paulo) region (config in `fly.toml`: `[build].dockerfile = "worker/Dockerfile"`, no `[http_service]` — pull-based queue; VM: `shared-cpu-2x` 2GB; scale with `fly scale count N`) **+ a self-hosted NUC** running the same `ghcr.io/<owner>/desgrava-worker:latest` image. Both compete for the same Redis queue; per-user serialization is enforced by the Redis distributed lock so they can run in parallel safely. The NUC runs four containers — worker + watchtower + portainer + cloudflared — set up via [worker/nuc/install.sh](worker/nuc/install.sh) and documented in [worker/nuc/README.md](worker/nuc/README.md). Watchtower polls GHCR every 5 minutes for `:latest` and gracefully replaces the worker container, so a push to `main` auto-deploys to both Fly (via `flyctl deploy`) and the NUC (via Watchtower) from the same image. The NUC keeps zero open inbound ports — Portainer (`worker.desgrava.ar`) and SSH (`worker-ssh.desgrava.ar`) are exposed via a Cloudflare Tunnel gated by Cloudflare Access (Google SSO).

**GitHub Actions** workflows:

- **CI** (`.github/workflows/ci.yml`) — runs on push/PR to main: lint, format check, build, test
- **Deploy worker** (`.github/workflows/deploy-worker.yml`) — runs on push to main after CI passes. Builds `worker/Dockerfile`, pushes the image to GHCR (`ghcr.io/<owner>/desgrava-worker:<sha>` + `:latest`), then `flyctl deploy --image …:<sha> --remote-only`. Same artifact runs on Fly + any self-hosted box. Requires `FLY_API_TOKEN` GitHub secret. After the first run, mark the GHCR package public so Fly can pull without auth.

**Cron schedule** (`vercel.json` `crons`): `sweep-stuck-jobs` every 5 min, plus three daily ones — `presentaciones` at 08:00 UTC, `subscription-reminders` at 09:00 UTC, `review-non-deductible` at 10:00 UTC. Each cron route exports both `POST` and `GET` and accepts either auth scheme (`x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`), via [src/lib/cron-auth.ts](src/lib/cron-auth.ts) `verifyCronAuth`. Vercel Cron requires the **Pro** plan for 4 entries (Hobby caps at 2). All handlers are idempotent — `presentaciones` skips users with an active job; `sweep-stuck-jobs` uses a CAS `updateMany` on `status="RUNNING"`.

**Stuck-job sweeper** (`/api/cron/sweep-stuck-jobs`): finds `AutomationJob` rows in `RUNNING` status whose `currentStepStartedAt` (or, as fallback, `startedAt`) is older than 20 minutes and marks them `FAILED` with a "worker desapareció" log entry. Protects against orphaned rows when a worker dies hard — the Redis user-lock TTL eventually expires, but without this sweep the DB row stays `RUNNING` forever. The threshold + pure helpers live in [src/lib/automation/stuck-jobs.ts](src/lib/automation/stuck-jobs.ts).

**Health check**: `/api/health` returns `{ status: "ok" }` — used by Fly.io HTTP checks.

**Pre-commit hooks** (husky + lint-staged): Prettier + ESLint auto-fix on staged `.ts/.tsx` files.

## Skills

Custom skills in `.claude/skills/`:

- `/implement <description>` — Full workflow: plan → implement → test → validate → document
- `/fix-bug <description>` — Investigate → fix → regression test → validate
- `/implement-loop <task>` — Autonomous loop: code until lint+format+build+test all pass (max 10 iterations). For ARCA/SiRADIG automation tasks, includes a live-testing loop: run job → check logs → observe with `agent-browser` → fix → retry.
- `/arca-assisted-navigation <flow>` — Record a live ARCA/SiRADIG browsing session, then generate Playwright automation code, tests, and docs. Auto-triggers when working on automation tasks.
- `/spec <description>` — Generate a feature spec grounded in the current project state. Reads `specs/_template.md`, understands architecture, asks clarifying questions, and writes to `specs/`. When the request mentions product, marketing, or pricing concepts (`onboarding`, `activation`, `retention`, `pricing`, `positioning`, `growth`, `acquisition`, `channel`, `PMF`, `landing`, `conversion`, etc.), the skill consults Lenny Rachitsky's MCP server (`https://mcp.lennysdata.com/mcp`, configured in `.mcp.json` as `lennys-data`) and cites Lenny-derived frameworks inline as `[Lenny: <framework>]`. The MCP is skipped for purely technical work and falls back gracefully on auth/network failure.
- `/fix-ticket [--env dev|prod]` — Scheduled bug fix agent: fetches open support tickets, classifies bugs via AI, fixes them with `/fix-bug`, creates `fix/<ticket-id>` branches and PRs, updates ticket status to `IN_PROGRESS`, and emails the developer.
- `/seo-audit` — Built-in skill (not in `.claude/skills/`). Audits the marketing site for technical SEO, on-page SEO, meta tags, Core Web Vitals, crawl/indexing issues, and ranking diagnostics. Use when asked to "audit SEO", "check SEO", "diagnose SEO issues", "improve rankings", or when investigating traffic/ranking drops on the landing page (`src/app/page.tsx` + `(public)` routes).

## Acceptance Criteria

Feature specs live in `specs/` as markdown with YAML frontmatter. Use `specs/_template.md` as a starting point. Reference specs when using `/implement`: `/implement specs/my-feature.md`.

## Environment Variables

`DATABASE_URL` (Supabase pooler, port 6543, transaction mode), `DIRECT_URL` (Supabase session pooler, port 5432, used by `prisma migrate` for DDL — pgbouncer transaction mode doesn't allow it), `ENCRYPTION_KEY` (64-char hex), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY` (for verification/reset emails), `CRON_SECRET` (for cron endpoint auth), `REDIS_URL` (required on every host — Vercel and every worker — for the job queue and per-user locks; the queue module fails loudly if it's unset), `SUPABASE_URL` (project URL, e.g. `https://xxxxx.supabase.co`), `SUPABASE_SERVICE_ROLE_KEY` (god-mode key for the service role — required on every host that reads or writes file blobs; never expose to clients), `MERCADOPAGO_ACCESS_TOKEN` (MercadoPago API key for subscriptions), `MERCADOPAGO_WEBHOOK_SECRET` (webhook signature validation), `SUPPORT_EMAIL` (email for new ticket notifications + bug fix PR notifications), `SUPPORT_WHATSAPP` (WhatsApp number for escalation, e.g. 5491112345678), `PROD_API_URL` (production API base URL for fix-ticket agent + cron workflows), `PROD_CRON_SECRET` (production CRON_SECRET for fix-ticket agent), `PROD_DATABASE_URL` (read-only prod DB connection string for fix-ticket agent to sync prod data locally), `FLY_API_TOKEN` (GitHub Actions secret for Fly.io deploys), `WORKER_ID` (worker only — stable id prefixed in worker logs; defaults to `os.hostname()`), `WORKER_CONCURRENCY` (worker only — max in-flight jobs per worker process; default `10`), `TELEGRAM_BOT_TOKEN` (optional, Telegram Bot API token for group notifications — notifications skipped when absent), `TELEGRAM_CHAT_ID` (optional, Telegram group chat ID for notifications), `TELEGRAM_WEBHOOK_SECRET` (optional, HMAC secret for signing Telegram inline-button `callback_data` and validating the `X-Telegram-Bot-Api-Secret-Token` header on `/api/webhooks/telegram` — required for the non-deductible catalog review flow), `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (optional, Umami Cloud website ID for analytics — script not loaded when absent), `NEXT_PUBLIC_UMAMI_URL` (optional, Umami instance URL — defaults to `https://cloud.umami.is`).
