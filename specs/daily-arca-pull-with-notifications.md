---
title: Daily ARCA pull with new-comprobante and new-recibo email notifications
status: implemented
priority: medium
---

> **Implementation note (2026-05-11):** The eligibility filter uses `ArcaCredential.isValidated = true` (the actual schema field) instead of `lastValidatedAt != null` as written in the original spec — same intent, just the existing column.

## Summary

A daily server-side batch enqueues a `PULL_COMPROBANTES` job for every eligible user, plus a `PULL_DOMESTIC_RECEIPTS` job for every eligible user who also has at least one registered `DomesticWorker`. When a job completes, if it created at least one new deducible row (Invoice or DomesticReceipt with `deductionCategory != NO_DEDUCIBLE`), the user gets a generic email with a CTA pointing directly to either `/comprobantes` or `/recibos` (separate emails per type so the link goes to the right page). Throttled to at most one email per type per user per day, so users with a slow drip of new comprobantes don't get spammed.

This automates the "Importar desde ARCA" button that users currently click manually, surfacing new deductions inside their dashboard as soon as ARCA exposes them — without requiring the user to remember to log in and refresh.

## Acceptance Criteria

### Cron + job enqueueing

- [ ] A new `POST /api/cron/daily-pull` route authenticates via `verifyCronAuth` (same pattern as `/api/cron/presentaciones`)
- [ ] A new entry is added to `vercel.json` crons: `/api/cron/daily-pull` at `0 6 * * *` (06:00 UTC ≈ 03:00 ART)
- [ ] The route iterates eligible users and enqueues one `PULL_COMPROBANTES` job per user with `fiscalYear = current calendar year`
- [ ] For each eligible user who has at least one `DomesticWorker` row, a `PULL_DOMESTIC_RECEIPTS` job is also enqueued
- [ ] **Eligibility filter**:
  - `Subscription.status IN (FOUNDER, TRIALING, ACTIVE)` OR (`status = CANCELLED` AND `currentPeriodEnd > now()`)
  - `ArcaCredential` row exists for the user with `lastValidatedAt != null` AND no validation failure since
  - `UserPreference.notifications = true` (default-true, so opt-out flips it off)
- [ ] Users with an in-flight `PULL_COMPROBANTES` or `PULL_DOMESTIC_RECEIPTS` job (PENDING/RUNNING) are skipped for that job type to avoid duplicates
- [ ] All jobs are created and published to Redis via `publishJob()` in a single pass — the per-user Redis lock + worker concurrency naturally serialize execution; no manual staggering
- [ ] The route returns a JSON summary `{ totalUsers, comprobantesJobs, recibosJobs, skipped }` and completes within Vercel's serverless limit
- [ ] The cron handler is idempotent: a re-run within the same UTC day produces zero new jobs because of the in-flight filter and `lastNotifiedAt` throttle

### Notify-on-completion flag

- [ ] `AutomationJob` gains a `notifyOnComplete Boolean @default(false)` column (Prisma migration)
- [ ] The daily-pull cron sets `notifyOnComplete = true` on every job it creates; the manual "Importar desde ARCA" button keeps `notifyOnComplete = false` so manual pulls never email
- [ ] At the end of `processPullComprobantes` and `processPullDomesticReceipts` in the job processor, after the job is marked COMPLETED, if `notifyOnComplete = true` the processor counts newly-inserted rows for the user with `deductionCategory != NO_DEDUCIBLE` created during this job and triggers the email if the count is > 0
- [ ] The count of "newly created deducible rows" comes from the job processor's own bookkeeping (the existing import flow already tracks newly-inserted invoice IDs in `resultData`) — no extra DB scan is added
- [ ] If the job fails (`JobStatus = FAILED`), no email is sent and no throttle timestamp is updated

### Email throttling

- [ ] `UserPreference` gains two columns (Prisma migration):
  - `lastComprobantesNotifiedAt DateTime?`
  - `lastRecibosNotifiedAt DateTime?`
- [ ] Before sending a comprobantes email, the processor checks `lastComprobantesNotifiedAt` and skips the send if it falls inside the current UTC day (defined as `>= startOfUtcDay(now)`)
- [ ] On a successful send, the corresponding `lastComprobantesNotifiedAt` / `lastRecibosNotifiedAt` is set to `now()` in the same transaction context as the job completion
- [ ] Each type's throttle is independent — a comprobantes send today does not gate the recibos send today

### Emails

- [ ] The existing `sendNewDeductibleInvoicesEmail(email)` in `src/lib/email.ts` is reused for the comprobantes notification (CTA → `/comprobantes`)
- [ ] A new `sendNewDeductibleReceiptsEmail(email)` is added in `src/lib/email.ts`, copying the existing helper's template with these adjustments:
  - Subject: `"Tenés nuevos recibos disponibles para desgravar"`
  - H1: `"Tenés nuevos recibos disponibles para desgravar"`
  - Body copy: brief paragraph about recibos salariales de empleadas de casas particulares being detected and ready to send to SiRADIG
  - CTA button: `"Ver mis recibos"` linking to `${NEXTAUTH_URL}/recibos`
- [ ] Both emails use the same visual template (white card, blue CTA, Helvetica/system fonts) already established in the codebase
- [ ] Neither email includes counts, amounts, CUITs, or per-user specifics — generic copy only
- [ ] Email sends are fire-and-forget inside `after()` so a Resend failure does not flip the job to FAILED

### Failure behavior

- [ ] Job failures are silent toward the user — no email is sent on FAILED jobs, even on repeated daily failures (out of scope for this spec)
- [ ] Failures are logged on the `AutomationJob` row as today and visible on `/automatizacion` as today

### Tests

- [ ] Unit tests for an eligibility helper (`isEligibleForDailyPull(user, preference, subscription, credential)`) covering each individual filter rule
- [ ] Unit tests for a throttle helper (`shouldSendNotificationToday(lastNotifiedAt, now)`) — same-UTC-day skip, prior-day allow, null allow
- [ ] Unit tests for `sendNewDeductibleReceiptsEmail` subject/body assembly mirroring the existing `sendBugFixPREmail` test pattern
- [ ] An integration-style test on the cron handler asserting that ineligible users (expired subscription / missing credential / notifications=false) are excluded from the enqueue set
- [ ] An integration-style test on the cron handler asserting that users with an in-flight job are skipped per-type
- [ ] An integration-style test asserting that a successful pull with new deducible rows triggers exactly one email and updates `lastComprobantesNotifiedAt` (and analogously for recibos)
- [ ] A test asserts that a successful pull with zero new deducible rows does NOT trigger an email and does NOT update the timestamp

## Technical Notes

### Schema changes (`prisma/schema.prisma`)

- `AutomationJob.notifyOnComplete Boolean @default(false)` — opt-in flag set only by the daily-pull cron, so manual UI-triggered pulls don't accidentally email users
- `UserPreference.lastComprobantesNotifiedAt DateTime?`
- `UserPreference.lastRecibosNotifiedAt DateTime?`
- Run `npx prisma migrate dev --name add-daily-pull-notifications`

### Cron implementation

- Lives at `src/app/api/cron/daily-pull/route.ts`, exporting both `POST` and `GET` (matches the auth pattern of the other crons — `verifyCronAuth` accepts `x-cron-secret` header or `Authorization: Bearer <CRON_SECRET>`)
- Single Prisma query joins `User` → `UserPreference` → `Subscription` → `ArcaCredential` with the eligibility filter; second query counts `DomesticWorker` per user to gate recibos enqueueing
- Job creation + `publishJob` follows the exact pattern already established in `src/app/api/cron/presentaciones/route.ts`
- No external retries — Vercel Cron fires once per UTC day

### Worker integration

- The two job-processor entry points that need to learn about `notifyOnComplete` are the existing handlers for `PULL_COMPROBANTES` and `PULL_DOMESTIC_RECEIPTS` in `src/lib/automation/job-processor.ts`
- After the job is marked COMPLETED and after `resultData` is persisted, the handler:
  1. Reads `job.notifyOnComplete`. If false, return.
  2. Computes `newDeducibleCount` from the same in-memory bookkeeping the processor already keeps (number of newly-created Invoice/Receipt rows with `deductionCategory != NO_DEDUCIBLE`). For receipts, treat every new receipt as deducible (recibos don't have a category enum).
  3. If `newDeducibleCount > 0`, calls `shouldSendNotificationToday(user.preference.lastComprobantesNotifiedAt, now())` (or `lastRecibosNotifiedAt`)
  4. If true, fires the corresponding `sendNewDeductibleInvoicesEmail` / `sendNewDeductibleReceiptsEmail` and updates the timestamp in a single `update` on `UserPreference`
- The email helper is invoked from inside the worker process — not from a Vercel route — so the existing Resend integration in the worker pool's runtime applies. Make sure `RESEND_API_KEY` is present in the worker env (it already is — used by other paths).

### Eligibility helper

- Lives at `src/lib/notifications/eligibility.ts` as a pure function for testability:
  ```ts
  isEligibleForDailyPull({
    subscription: { status, currentPeriodEnd },
    preference: { notifications },
    credential: { lastValidatedAt },
    now: Date,
  }): boolean
  ```
- Same module exports `shouldSendNotificationToday(lastNotifiedAt: Date | null, now: Date): boolean` (the start-of-UTC-day comparison)

### CLAUDE.md updates

- Document the new cron under "Cron schedule"
- Document the throttle columns and `notifyOnComplete` flag under "Key Patterns"
- Note that the daily pull respects `UserPreference.notifications` so users can opt out from `/configuracion`

## Out of Scope

- An in-app notification badge / bell icon (email-only for this iteration)
- WhatsApp or Telegram notifications to the user (only ARCA-admin Telegram exists today; user channels remain email)
- Repeated-failure escalation email (3-failures-in-a-row → "please re-validate credentials") — explicitly chosen as silent for now
- Including counts, CUITs, or per-user specifics in the email body
- Sending a single combined "comprobantes + recibos" email — by spec, the two CTAs go to different pages so they must be separate emails
- Per-user opt-out at the type level (one toggle controls both `comprobantes` and `recibos`; the existing `UserPreference.notifications` switch governs everything)
- Staggering the cron across the day or hashing users into hour slots — queue + per-user lock are expected to drain naturally; revisit if throughput becomes an issue
- Updating any existing manual "Importar desde ARCA" flows or the ARCA progress strip behavior — `notifyOnComplete=false` is the default so the manual flow is untouched
- Pulling other artifacts beyond comprobantes and recibos (no `PULL_PRESENTACIONES`, `PULL_FAMILY_DEPENDENTS`, etc. on the daily schedule)
- Localizing emails to anything other than Spanish (matches the rest of the product)
