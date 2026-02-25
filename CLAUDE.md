# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desgrava.ar is a tax deduction automation platform for Argentine taxpayers. It helps users calculate tax savings, manage invoices (manual + OCR from PDFs), and automatically submit deductions to ARCA/SiRADIG via browser automation.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npx prisma migrate dev --name <name>` | Create database migration |
| `npx prisma generate` | Regenerate Prisma client (output: `src/generated/prisma/`) |

No test framework is configured yet.

## Tech Stack

Next.js 16 (App Router), TypeScript (strict), PostgreSQL via Prisma 7, NextAuth 4 (Google OAuth + Prisma adapter), shadcn/ui + Tailwind CSS 4 + Radix UI, Playwright for browser automation, Tesseract.js + pdf-parse for OCR.

## Architecture

**Route groups** organize the app by access level:
- `(public)/` — unauthenticated pages (e.g., `/simulador`)
- `(auth)/` — login flow (Google OAuth)
- `(dashboard)/` — protected routes, checked via `getServerSession()` in layout

**API routes** (`src/app/api/`) mirror domain structure: `/facturas`, `/credenciales`, `/automatizacion`, `/simulador/calcular`, `/configuracion`. All protected routes validate `session?.user?.id`.

**Business logic** lives in `src/lib/`, organized by domain:
- `simulador/` — Tax calculation engine with Argentine tax brackets, deduction rules, and Zod schemas
- `ocr/` — Document processing pipeline (pdf-parse first, Tesseract fallback) + field extraction
- `automation/` — Playwright-based ARCA/SiRADIG automation: job processor, browser pool, navigators, CSS selectors, deduction mapper
- `crypto/encryption.ts` — AES-256-GCM for ARCA credentials (encrypt/decrypt at API boundary)
- `validators/` — Zod schemas for invoices, credentials, CUIT format

**UI components** (`src/components/`) are split by feature domain (`facturas/`, `automatizacion/`, `credenciales/`, `simulador/`) with shared shadcn components in `ui/`.

## Key Patterns

- **All monetary calculations** use `Decimal.js` (never floating-point) for tax math precision.
- **ARCA credentials** are encrypted with AES-256-GCM, decrypted only on-demand for automation jobs, never kept in memory.
- **Automation jobs** are queued with status tracking (PENDING → RUNNING → COMPLETED/FAILED), real-time JSON logs, screenshot capture, and max 3 retries.
- **OCR pipeline** tries pdf-parse for text-based PDFs, falls back to Tesseract for scanned documents.
- **Path alias**: `@/*` maps to `./src/*`.
- **Naming**: Spanish names in ARCA/SiRADIG-specific automation code, English elsewhere.

## Environment Variables

`DATABASE_URL`, `ENCRYPTION_KEY` (64-char hex), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`.
