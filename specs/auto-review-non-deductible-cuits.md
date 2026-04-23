---
title: Auto-review non-deductible CUITs for reclassification
status: implemented
priority: medium
---

## Summary

Many providers in `ProviderCatalog` get classified as `NO_DEDUCIBLE` during invoice creation based on partial information (no PDF, failed web lookup, ambiguous AI classification). Over time, this leaves users with invoices flagged as non-deductible when they might actually qualify for tax relief. This feature adds a daily server-side batch that re-classifies every `NO_DEDUCIBLE` entry in the catalog using a fresh web lookup (sistemas360.ar / cuitonline.com) combined with aggregated invoice metadata from all users. When the re-classification finds a deductible category, a Telegram message with inline approval buttons is sent to the admin. On approval, the catalog entry and all `NO_DEDUCIBLE` invoices across all users are updated to the new category, and affected users receive a generic email inviting them back to their comprobantes page.

## Acceptance Criteria

### Batch processor

- [ ] A new `src/lib/catalog/review-non-deductible.ts` module exports `reviewNonDeductibleCatalog()` that iterates all `NO_DEDUCIBLE` entries in `ProviderCatalog`
- [ ] For each CUIT, the reviewer performs a fresh `lookupCuit360()` → `lookupCuitOnline()` fallback, aggregates invoice metadata (most-common `providerName`, most-common `invoiceType`, average `amount`) from all users' `NO_DEDUCIBLE` invoices with that CUIT, and calls `classifyCategory()` on the combined context
- [ ] The reviewer ignores the existing cached category on purpose — it does NOT short-circuit on the catalog hit for this flow
- [ ] If the re-classification returns a deductible category (anything other than `NO_DEDUCIBLE`), a Telegram message is sent to the admin with inline keyboard buttons `✅ Aprobar` and `❌ Rechazar`
- [ ] The Telegram message includes: CUIT, razón social, current category (`NO_DEDUCIBLE`), proposed category, number of affected invoices, number of affected users, and the top activity description from the web lookup
- [ ] If the re-classification still returns `NO_DEDUCIBLE`, no message is sent and the entry's `lastReviewedAt` is updated to skip it for the next N days
- [ ] A `lastReviewedAt` timestamp is added to `ProviderCatalog` and used to skip entries reviewed within the last 30 days (avoids re-flagging the same CUIT daily)
- [ ] The batch is bounded to a maximum of 50 CUITs per run to control OpenAI/web-lookup costs

### Cron endpoint

- [ ] A new `POST /api/cron/review-non-deductible` route authenticates via `x-cron-secret` header (same pattern as `/api/cron/presentaciones`)
- [ ] The route invokes `reviewNonDeductibleCatalog()` via `after()` for background execution and returns a summary (`{ processed, flagged, skipped }`) immediately
- [ ] A new GitHub Actions workflow `.github/workflows/cron-review-non-deductible.yml` runs daily at 10:00 UTC, POSTing to `PROD_API_URL/api/cron/review-non-deductible` with `CRON_SECRET`

### Telegram approval flow

- [ ] A new `POST /api/webhooks/telegram` route handles Telegram callback queries (inline button clicks)
- [ ] `callback_data` encodes the action and CUIT using a short, signed format: `catalog:approve:<cuit>:<hmac>` / `catalog:reject:<cuit>:<hmac>`, where the HMAC is computed with `TELEGRAM_WEBHOOK_SECRET` to prevent unauthorized approvals
- [ ] On approve: the webhook updates `ProviderCatalog.deductionCategory` to the proposed category, updates every `Invoice` with that `providerCuit` and `deductionCategory = NO_DEDUCIBLE` to the new category, and triggers a user email batch
- [ ] On reject: the webhook updates `lastReviewedAt` on the catalog entry (to skip for 30 days) and edits the original Telegram message to show "Rechazado"
- [ ] After handling the callback, the webhook edits the original Telegram message to show the final state (`✅ Aprobado → CATEGORY` or `❌ Rechazado`) and the admin who decided (if available)
- [ ] The proposed category is persisted alongside the flagged entry so that when the admin clicks approve, the system knows what to update to — store it in a new `CatalogReviewProposal` table keyed by CUIT (with fields: `cuit`, `proposedCategory`, `createdAt`, `resolvedAt`, `resolution`)

### User notification

- [ ] After a reclassification is approved, `sendNewDeductibleInvoicesEmail(userEmail)` is called for every user who had at least one invoice re-categorized
- [ ] The email subject is "Tenés nuevos comprobantes disponibles para desgravar" and the body is a generic message with a CTA button linking to `NEXTAUTH_URL/facturas`
- [ ] The email does not include CUITs, amounts, categories, or per-user specifics — it is one generic template shared across recipients
- [ ] Emails are sent via Resend (same pattern as `sendVerificationEmail` in `src/lib/email.ts`)
- [ ] Email sends are fire-and-forget; a failure on one user does not block the others

### Tests

- [ ] Unit tests cover: invoice metadata aggregation, skip logic based on `lastReviewedAt`, HMAC signing/verification of callback data, and email subject/body assembly
- [ ] A test asserts that approval updates both the catalog entry and all matching invoices in a single transaction
- [ ] A test asserts that reject only updates `lastReviewedAt` and leaves invoices untouched

## Technical Notes

### Schema changes (`prisma/schema.prisma`)

- Add `lastReviewedAt DateTime?` to `ProviderCatalog` to gate re-reviews
- Add a new `CatalogReviewProposal` model to track open proposals:
  ```
  model CatalogReviewProposal {
    id                String    @id @default(cuid())
    cuit              String
    proposedCategory  DeductionCategory
    telegramMessageId String?   // for editing the message on resolution
    resolvedAt        DateTime?
    resolution        String?   // "APPROVED" | "REJECTED"
    createdAt         DateTime  @default(now())
    @@index([cuit])
  }
  ```
- Run `npx prisma migrate dev --name add-catalog-review`

### Review module

- Lives in `src/lib/catalog/review-non-deductible.ts` to keep existing `resolveCategory()` in `provider-catalog.ts` untouched (this flow deliberately ignores the cache)
- Aggregates invoice metadata via a Prisma `groupBy` on `Invoice` filtered by `providerCuit` and `deductionCategory = NO_DEDUCIBLE`, then joins with the most-common `providerName` per CUIT
- Reuses the existing `lookupCuit360` / `lookupCuitOnline` / `classifyCategory` functions — no duplication of web-lookup logic
- Respects the same 5s timeout and keyword pre-check conventions used in `resolveCategory`

### Telegram inline keyboard

- `src/lib/telegram.ts` gets two new exports:
  - `sendCatalogReviewProposal({ cuit, razonSocial, proposedCategory, invoiceCount, userCount, activityDescription })` — sends the message with the inline keyboard and returns the Telegram `message_id` to persist on `CatalogReviewProposal.telegramMessageId`
  - `editCatalogReviewMessage(messageId, resolution)` — edits the original message to show the final state after a callback
- Inline keyboard payload uses Telegram's `reply_markup.inline_keyboard` with two buttons; `callback_data` must stay under 64 bytes, so use the short-form `catalog:a:<cuit>:<hmac8>` / `catalog:r:<cuit>:<hmac8>` (8-byte truncated HMAC)
- A new env var `TELEGRAM_WEBHOOK_SECRET` signs the callback data; documented in `CLAUDE.md`
- The Telegram bot must have its webhook pointed at `POST /api/webhooks/telegram` via `setWebhook` (documented in the PR description, not automated — it's a one-time setup)

### Webhook route

- `POST /api/webhooks/telegram` parses the `CallbackQuery` payload, validates the HMAC, looks up the open `CatalogReviewProposal` for the CUIT, and performs the update inside a Prisma `$transaction` (catalog update + invoice bulk update)
- The webhook must respond to Telegram within 10s — the user email batch runs inside `after()` so the webhook responds immediately after the DB transaction commits
- Idempotency: if `resolvedAt` is already set, the webhook edits the message to show the existing resolution and exits without re-applying changes

### Email

- Add `sendNewDeductibleInvoicesEmail(email: string)` to `src/lib/email.ts` — follows the existing Resend helper pattern
- Template is static HTML with one CTA button pointing to `${NEXTAUTH_URL}/facturas`
- Batched sends use `Promise.allSettled` inside `after()` so a Resend failure on one recipient does not abort the rest

### Cost and safety

- Cap of 50 CUITs per run (with a 30-day skip window) means the OpenAI spend per day is bounded
- Web lookups use the existing 5s timeout — slow or offline directories do not stall the batch
- The approval flow is always human-in-the-loop; nothing is updated in the DB without an admin's explicit click

### CLAUDE.md updates

- Add `TELEGRAM_WEBHOOK_SECRET` to the env vars list
- Document the new cron workflow and `CatalogReviewProposal` model in the architecture/"Key Patterns" section

## Out of Scope

- An admin web UI for reviewing/approving proposals (Telegram-only for now)
- Bulk approval of multiple CUITs at once
- Automatic approval of high-confidence proposals without admin review
- Re-classifying categories other than `NO_DEDUCIBLE` (e.g., catching mis-classified `OTRAS_DEDUCCIONES` entries)
- Per-user opt-out of the notification email (generic announcement only)
- Showing which specific invoices were re-categorized — email is generic, users inspect their `/facturas` page
- Undo/rollback after approval (admin must manually fix via DB or future admin UI)
- Re-running classification for CUITs that reach `NO_DEDUCIBLE` via the hardcoded `NON_DEDUCTIBLE_KEYWORDS` pre-check — these are intentionally excluded since they're high-confidence non-deductibles (supermarkets, gas stations, etc.)
