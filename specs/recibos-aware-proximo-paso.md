---
title: Recibos-aware "Próximo paso" card
status: implemented
priority: medium
---

## Summary

The post-onboarding "Próximo paso" card on `/panel` is the activation hand-rail that tells the user the single most useful thing to do next. Today its 5-branch state machine is comprobante-shaped: it merges receipt counts into `pendingCount` but its copy and CTAs only ever talk about invoices, so a user who imports recibos salariales but no comprobantes lands on the dashboard and sees either "Importá tus comprobantes" or "Todo al día" — both wrong. This feature extends the state machine with two recibos-aware branches so users with pending domestic-worker receipts are guided to either (a) review and submit them to SiRADIG when their worker is registered, or (b) register the missing trabajador first when the receipt has no matching `DomesticWorker`. Comprobantes keep priority — the recibos branches only fire when there are no pending invoices to act on. [Lenny: activation hand-rail / Sean Ellis aha-moment framing — the next-step CTA must point to the next deductible action, not a generic "todo al día"]

## Acceptance Criteria

### State machine

- [ ] `ProximoPasoInputs` in `src/lib/onboarding/proximo-paso-state.ts` is extended with: `pendingInvoiceCount: number`, `pendingReceiptCount: number`, `hasUnregisteredWorker: boolean`, `totalDeducibleInvoices: number`, `totalDeducibleReceipts: number`. The legacy `pendingCount` and `totalDeducible` are removed (callers updated).
- [ ] `ProximoPasoVariant` adds `"review-recibos"` and `"register-trabajador"`. The full ordered branch list becomes:
  1. `hasRunningImport` → `importing`
  2. `pendingInvoiceCount > 0` → `review-month` (unchanged copy)
  3. `pendingReceiptCount > 0 && hasUnregisteredWorker` → `register-trabajador`
  4. `pendingReceiptCount > 0` → `review-recibos`
  5. `totalDeducibleInvoices === 0 && totalDeducibleReceipts === 0` → `no-invoices` (unchanged copy)
  6. `allSubmitted` → `ready-to-present` (unchanged copy)
  7. else → `all-set`
- [ ] `review-recibos` branch:
  - title: `"Tenés N recibos sin desgravar"` (singular: `"Tenés 1 recibo sin desgravar"`)
  - body: `"Mandalos a SiRADIG para sumar la deducción del personal doméstico."`
  - primary CTA: `{ label: "Revisar recibos", href: "/recibos", variant: "primary" }`
- [ ] `register-trabajador` branch:
  - title: `"Registrá a tu trabajador"`
  - body: `"Importamos N recibo(s) pero falta cargar el trabajador para poder desgravarlos."`
  - primary CTA: `{ label: "Ir a Trabajadores", href: "/trabajadores", variant: "primary" }`
- [ ] All existing branches keep their current copy and CTAs verbatim.

### Panel page wiring

- [ ] `src/app/(dashboard)/panel/page.tsx` stops passing the combined `pendingCount` to `MetricsPanel` and instead computes and passes:
  - `pendingInvoiceCount` (existing query)
  - `pendingReceiptCount` (existing query)
  - `totalDeducibleInvoices` (existing `totalInvoices`)
  - `totalDeducibleReceipts` (`prisma.domesticReceipt.count({ where: { userId, fiscalYear } })`)
  - `hasUnregisteredWorker` — `true` iff there exists at least one `DomesticReceipt` for the current fiscal year whose `domesticWorkerId IS NULL`. Add a lightweight `findFirst({ select: { id: true } })` to `Promise.all`.
- [ ] `allSubmitted` is recomputed against invoices+receipts: `(totalDeducibleInvoices + totalDeducibleReceipts) > 0 && pendingInvoiceCount === 0 && pendingReceiptCount === 0`.
- [ ] `MetricsPanel` and `ProximoPasoCard` props are extended to thread the new fields through. `pendingCount` summary (used elsewhere on the dashboard) is preserved as `pendingInvoiceCount + pendingReceiptCount` so existing displays don't change.

### Behavior

- [ ] User with N pending receipts and 0 pending invoices, worker registered → card shows `review-recibos` and links to `/recibos`.
- [ ] User with N pending receipts but at least one receipt has `domesticWorkerId = null` → card shows `register-trabajador` and links to `/trabajadores`, regardless of whether other receipts already have a worker.
- [ ] User with pending invoices AND pending receipts → `review-month` wins (comprobantes priority), exactly as today.
- [ ] User with no invoices and only submitted receipts → `all-set` (not `no-invoices`).
- [ ] When the recibos import strip transitions to `done` and a new receipt becomes pending, the card flips to the recibos branch on the next refresh (the existing `useArcaImportProgress` snapshot already triggers re-renders; no new polling).

### Mobile responsiveness

- [ ] All new branch copy fits within the existing card layout at 320px width without truncation; long titles wrap rather than ellipsize. The single CTA button keeps the existing `min-h-[44px]` touch target.

### Tests

- [ ] `src/lib/onboarding/__tests__/proximo-paso-state.test.ts` adds cases for: `review-recibos` vs `review-month` priority, `register-trabajador` precedence over `review-recibos`, `all-set` when only submitted receipts exist, and unchanged behavior for the original 5 branches (regression).
- [ ] No new tests are required for the panel page (server component, currently untested) — manual verification only.

## Technical Notes

- **Single source of truth**: keep all branch logic inside `deriveProximoPasoState`. The component (`src/components/dashboard/proximo-paso-card.tsx`) stays presentational — no recibos-specific conditionals leak into JSX.
- **Naming**: existing variants use English (`review-month`, `no-invoices`); new ones follow that convention (`review-recibos`, `register-trabajador`). User-facing copy stays Spanish per the project convention.
- **Pluralization**: implement inline like the existing `comprobante${pendingCount === 1 ? "" : "s"}` pattern in `proximo-paso-state.ts:76`. No new i18n helper.
- **`hasUnregisteredWorker` query**: gate it on `pendingReceiptCount > 0` so the extra Prisma call is skipped when there are no pending receipts. Use `findFirst` (not `count`) — we only need a boolean.
- **No new CTA action type**: both new CTAs use `href` (deep-link to existing pages). The existing `import-comprobantes` action is reused only by the unchanged branches. Don't add `import-recibos` — recibos are pulled by `PULL_DOMESTIC_RECEIPTS` which is part of the unified ARCA strip, not a per-card button.
- **Mobile-first**: card already renders at 320px today; no new layout work is needed.
- **Activation framing**: this is the user's day-1/day-7 activation hand-rail — pointing them at the next deductible action, not a generic dashboard. The North Star event from `0-to-1000-users-growth-plan.md` is "first successful SiRADIG submission within 14 days of signup" — recibos can be a faster path to that event for users with domestic workers, since `SUBMIT_DOMESTIC_DEDUCTION` doesn't require provider classification. [Lenny: Albert Cheng on activation as the highest-leverage moment in the funnel; Elena Verna on smoothing the path from setup to aha]

## Out of Scope

- Surfacing recibos and comprobantes pending counts side-by-side in two cards (user explicitly chose: same panel slot, comprobantes priority).
- Auto-submitting receipts to SiRADIG from the card (still a manual action on `/recibos`).
- A new branch for "import recibos" when the user has trabajadores but no receipts — the unified ARCA strip already covers `PULL_DOMESTIC_RECEIPTS`, so a separate CTA would duplicate it.
- Per-month review prompts for receipts (the comprobante "review-month" branch keys off `currentMonth`; receipts don't get the same treatment).
- Notifying users via email/Telegram when receipts become pending.
- Changes to `aggregate-progress.ts` or the ARCA progress strip.
- Any change to the Comprobantes/Recibos/Trabajadores pages themselves.
