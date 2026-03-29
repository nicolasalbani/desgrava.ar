# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desgrava.ar is a tax deduction automation platform for Argentine taxpayers. It helps users calculate tax savings, manage invoices (manual + OCR from PDFs), classify invoice categories with AI, and automatically submit deductions to ARCA/SiRADIG via browser automation.

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

**API routes** (`src/app/api/`) mirror domain structure: `/facturas`, `/credenciales`, `/automatizacion`, `/simulador/calcular`, `/configuracion`, `/trabajadores`, `/recibos`, `/presentaciones`, `/empleadores`, `/cron/presentaciones`. All protected routes validate `session?.user?.id`.

**Business logic** lives in `src/lib/`, organized by domain:

- `simulador/` — Tax calculation engine with Argentine tax brackets, deduction rules, and Zod schemas
- `ocr/` — Document processing pipeline (pdf-parse first, Tesseract fallback) + field extraction
- `automation/` — Playwright-based ARCA/SiRADIG automation: job processor, browser pool, navigators, CSS selectors, deduction mapper
- `crypto/encryption.ts` — AES-256-GCM for ARCA credentials (encrypt/decrypt at API boundary)
- `email.ts` — Resend integration for verification and password reset emails
- `rate-limit.ts` — In-memory rate limiter for auth endpoints
- `catalog/` — Global provider catalog: CUIT → deduction category lookup with sistemas360.ar enrichment
- `validators/` — Zod schemas for invoices, credentials, CUIT format, domestic workers/receipts
- `domestic/` — Domestic workers domain logic (schemas, validators)

**UI components** (`src/components/`) are split by feature domain (`facturas/`, `recibos/`, `trabajadores/`, `automatizacion/`, `credenciales/`, `simulador/`, `presentaciones/`, `landing/`, `auth/`) with shared components in `shared/` (e.g., `JobStatusBadge`, `JobHistoryPanel`, `PaginationControls`), shadcn components in `ui/`, and layout components in `layout/`.

**Hooks** (`src/hooks/`) contain shared React hooks:

- `use-paginated-fetch` — Generic hook for server-side paginated data fetching with debounced search, filter management, and polling support. Used by `InvoiceList`, `ReceiptList`, and `PresentacionesList`.

## Key Patterns

- **All monetary calculations** use `Decimal.js` (never floating-point) for tax math precision.
- **ARCA credentials** are encrypted with AES-256-GCM, decrypted only on-demand for automation jobs, never kept in memory.
- **Automation jobs** are queued with status tracking (PENDING → RUNNING → COMPLETED/FAILED), real-time step-based progress, screenshot capture. Job status is embedded inline in each invoice/receipt row (no separate page). Each row shows its latest job status and can expand to show full job history with step checklist. There is no retry — users re-send to create a fresh job. Jobs are audit records deleted only via cascade when the parent invoice/receipt is deleted. Step definitions live in `src/lib/automation/job-steps.ts` (`JOB_TYPE_STEPS`) — the single source of truth for all user-facing progress steps. Raw logs are still stored in the DB for debugging but never shown to users; the `StepProgress` component (`src/components/shared/step-progress.tsx`) renders the checklist UI.
- **ARCA login** (`arca-navigator.ts`) uses `domcontentloaded` + explicit element waits (not `networkidle`) because ARCA's login pages have persistent connections that cause `networkidle` to hang, especially from remote servers. The ARCA portal and SiRADIG popup use `networkidle` for their `goto`/load since they are SPAs that render content via AJAX after the `load` event fires.
- **SiRADIG** is a single-page jQuery app. After the initial page load, all interactions are AJAX. Use `networkidle` for waits inside SiRADIG (it works because AJAX requests are finite), but never for ARCA login page navigation.
- **OCR pipeline** tries pdf-parse for text-based PDFs, falls back to Tesseract for scanned documents.
- **AI category classification** uses OpenAI to auto-detect invoice deduction categories when users upload or create invoices. The global `ProviderCatalog` table caches categories by CUIT — once a provider is classified, all users benefit. For unknown CUITs without PDF text, the system enriches classification context by fetching business activity data from `sistemas360.ar/cuit/{cuit}`. The `NO_DEDUCIBLE` category is system-internal: assigned by AI when a provider is clearly non-deductible (supermarkets, utilities, etc.), never user-selectable in forms, excluded from tax calculations, and blocked from SiRADIG submission. `DEDUCTION_CATEGORIES` is the user-facing subset; `ALL_DEDUCTION_CATEGORIES` includes `NO_DEDUCIBLE` for internal/AI use.
- **Invoice management** uses Dialog modals for upload and manual entry, with multi-select popover filters (categories, statuses) on the table view. Both facturas and recibos use server-side pagination via `usePaginatedFetch` — filtering, search, and pagination are handled by the API with Prisma `skip`/`take` and `count()` in parallel.
- **Credential validation** calls `/api/credenciales/validar` after saving to verify ARCA credentials work.
- **Path alias**: `@/*` maps to `./src/*`.
- **Naming**: Spanish names in ARCA/SiRADIG-specific automation code, English elsewhere.
- **Design**: Jony Ive-inspired — clean whites, `border-gray-200` borders, `bg-gray-50` content areas, generous whitespace, translucent navbar with backdrop blur. Consistent palette across landing page and dashboard.

## Testing

**Framework**: Vitest with 656+ tests across 28 test files.

**Test location**: Tests live in `__tests__/` directories alongside their modules (e.g., `src/lib/simulador/__tests__/calculator.test.ts`).

**Covered modules**:

- `simulador/` — calculator, deduction-rules, tax-tables, schemas (125 tests)
- `validators/` — cuit, invoice, credentials (55 tests)
- `crypto/` — encryption round-trip and tamper detection (17 tests)
- `automation/` — deduction-mapper, selectors, presentacion selectors, job-steps, siradig-extractor (149 tests)
- `ocr/` — field-extractor, pipeline (22 tests)
- `catalog/` — provider-catalog HTML parser (8 tests)
- `ocr/` — receipt-extractor for domestic worker salary receipts (26 tests)
- `validators/` — domestic worker and receipt schemas (32 tests)
- `invite-codes` — token creation and validation (15 tests)
- `hooks/` — usePaginatedFetch buildParams helper (16 tests)
- `validators/` — password complexity rules, schemas (24 tests)
- `rate-limit` — in-memory rate limiter (5 tests)

**Writing new tests**: Always create tests for new `src/lib/` and `src/hooks/` modules. Place them in `__tests__/` alongside the module. Use `@/` path aliases. Run `npm run test` to validate.

## CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`) runs on push/PR to main:

1. **lint-and-format** — ESLint + Prettier check
2. **build** — Next.js production build (depends on lint)
3. **test** — Vitest (runs in parallel with build)

**Pre-commit hooks** (husky + lint-staged): Prettier + ESLint auto-fix on staged `.ts/.tsx` files.

## Skills

Custom skills in `.claude/skills/`:

- `/new-feature <description>` — Full workflow: plan → implement → test → validate → document
- `/fix-bug <description>` — Investigate → fix → regression test → validate
- `/implement-loop <task>` — Autonomous loop: code until lint+format+build+test all pass (max 10 iterations). For ARCA/SiRADIG automation tasks, includes a live-testing loop: run job → check logs → observe with `agent-browser` → fix → retry.
- `/arca-assisted-navigation <flow>` — Record a live ARCA/SiRADIG browsing session, then generate Playwright automation code, tests, and docs. Auto-triggers when working on automation tasks.
- `/write-spec <description>` — Generate a feature spec grounded in the current project state. Reads `specs/_template.md`, understands architecture, asks clarifying questions, and writes to `specs/`.

## Acceptance Criteria

Feature specs live in `specs/` as markdown with YAML frontmatter. Use `specs/_template.md` as a starting point. Reference specs when using `/new-feature`: `/new-feature specs/my-feature.md`.

## Environment Variables

`DATABASE_URL`, `ENCRYPTION_KEY` (64-char hex), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY` (for verification/reset emails), `CRON_SECRET` (for Railway cron endpoint auth).
