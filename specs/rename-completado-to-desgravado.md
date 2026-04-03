---
title: Rename "Completado" Status Label to "Desgravado"
status: implemented
priority: medium
---

## Summary

Rename the user-facing job status label from "Completado" to "Desgravado" for automation jobs (`JobStatus.COMPLETED`). This aligns the status language with the app's core value proposition — deductions were successfully submitted to SiRADIG, not just "completed." The database enum (`COMPLETED`) stays unchanged; only the display label changes.

## Acceptance Criteria

- [ ] `JobStatusBadge` displays "Desgravado" instead of "Completado" for `COMPLETED` jobs
- [ ] `JobHistoryPanel` displays "Desgravado" instead of "Completado"
- [ ] `InvoiceList` (`JOB_STATUS_LABELS`) maps `COMPLETED` → "Desgravado"
- [ ] `ReceiptList` (`JOB_STATUS_LABELS`) maps `COMPLETED` → "Desgravado"
- [ ] `EmailIngestCard` keeps "Completado" for `EmailIngestStatus.COMPLETED` (not a deduction flow)
- [ ] Email template in `src/lib/email/ingest.ts` keeps "Completado" (email ingestion, not deductions)
- [ ] No database or enum changes — only UI labels
- [ ] All existing tests pass

## Technical Notes

- 4 label mappings need updating (all `JobStatus`-related):
  - `src/components/shared/job-status-badge.tsx` — `JOB_STATUS_CONFIG`
  - `src/components/shared/job-history-panel.tsx` — `STATUS_CONFIG`
  - `src/components/facturas/invoice-list.tsx` — `JOB_STATUS_LABELS`
  - `src/components/recibos/receipt-list.tsx` — `JOB_STATUS_LABELS`
- 2 mappings should NOT change (they use `EmailIngestStatus.COMPLETED`, not job status):
  - `src/components/configuracion/email-ingest-card.tsx`
  - `src/lib/email/ingest.ts`

## Out of Scope

- Renaming the `COMPLETED` database enum value.
- Changing `EmailIngestStatus.COMPLETED` label — email ingestion is not a deduction flow.
- Changing the visual styling (emerald dot/checkmark) of the status.
- Renaming other status labels (Pendiente, Ejecutando, Error, Cancelado).
