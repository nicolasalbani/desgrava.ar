---
title: Remove "Enviar a SiRADIG" page and embed job status into Facturas/Recibos rows
status: implemented
priority: high
---

## Summary

Eliminate the standalone "Enviar a SiRADIG" page (`/automatizacion`) and embed automation job status directly into each invoice/receipt row in the Facturas and Recibos tables. Instead of a separate panel or page, every row shows the status of its most recent SiRADIG submission, and users can expand a row to see its full job history. This simplifies the workflow from three pages to two and makes the submission lifecycle a first-class part of each invoice/receipt.

## Acceptance Criteria

### Job status embedded in each row

- [ ] Each invoice row in the Facturas table displays the status of its latest `SUBMIT_INVOICE` job (e.g., Pendiente, Ejecutando, Completado, Error) as a badge or indicator
- [ ] Each receipt row in the Recibos table displays the status of its latest `SUBMIT_DOMESTIC_DEDUCTION` job similarly
- [ ] Rows with no prior submission show no job status (or a neutral "No enviado" state)
- [ ] Row status auto-refreshes while any linked job is in PENDING or RUNNING state

### Job history per row

- [ ] Users can expand/click a row to see all past job executions for that specific invoice or receipt, ordered by most recent first
- [ ] Each job execution entry shows: status, creation date, and access to logs/screenshots/artifacts
- [ ] Job records are kept as an audit trail — users cannot manually delete individual jobs

### Submission behavior

- [ ] Users can send any invoice or receipt to SiRADIG regardless of current job status — whether it has never been sent, previously failed, or previously succeeded
- [ ] The "Enviar a SiRADIG" action (from selection bar or row action) creates a new job. It does not retry or reuse a previous job
- [ ] When a submission is triggered, the row immediately reflects the new PENDING/RUNNING state
- [ ] When an automation is running (PENDING or RUNNING), the user can cancel it from the row

### Cascade deletion

- [ ] Deleting an invoice also deletes all its linked automation jobs (cascade delete)
- [ ] Deleting a receipt also deletes all its linked automation jobs (cascade delete)
- [ ] This is transparent to the user — no separate job cleanup needed

### Remove the standalone page

- [ ] Delete the `/automatizacion` route (`src/app/(dashboard)/automatizacion/page.tsx`)
- [ ] Remove the "Enviar a SiRADIG" link from the sidebar/navigation
- [ ] Delete the `PendingInvoicesPanel` and `AutomationDashboard` components (or archive if useful for reference)
- [ ] Redirect `/automatizacion` to `/facturas` (temporary redirect for bookmarks/history)

## Technical Notes

### Data model

Ensure `AutomationJob` has a foreign key relationship to both `Invoice` and `Receipt` with `onDelete: Cascade` in the Prisma schema. This guarantees cascade deletion. If the current schema uses a loose `invoiceId`/`receiptId` without cascade, add a migration to set it.

### Fetching job status per row

Two approaches (pick based on performance):

1. **Eager join**: When fetching invoices/receipts, include the latest job via a Prisma `include` with `orderBy: { createdAt: 'desc' }` and `take: 1`. This adds one join but gives status in the initial load.
2. **Separate query**: Fetch all job statuses for the visible page in a single batch query, keyed by `invoiceId`/`receiptId`. Merge client-side.

Option 1 is simpler. The full job history for a row can be lazy-loaded on expand.

### Row UX

- The job status badge sits in a "SiRADIG" column in the table
- Expandable row detail (accordion or drawer) shows the full job execution history
- Cancel button appears inline when a job is RUNNING/PENDING
- "Enviar a SiRADIG" is available as a row-level action (not just in the bulk selection bar) so users can submit individual items easily

### No retry — always new submission

Remove the retry concept. Every "Enviar a SiRADIG" action creates a fresh `AutomationJob`. The previous job stays in history as audit. This simplifies the mental model: there is only "send" and "cancel", never "retry".

### Navigation update

Update the sidebar nav to remove the "Enviar a SiRADIG" entry. The sidebar should show: Facturas, Recibos, Trabajadores, Credenciales, Configuracion (and Simulador if present).

### Scope of job types per page

- **Facturas** — only `SUBMIT_INVOICE` jobs are shown/linked
- **Recibos** — only `SUBMIT_DOMESTIC_DEDUCTION` jobs are shown/linked
- Other job types (`PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`, etc.) are import jobs not tied to individual rows — they remain triggered from their respective page-level buttons and can show progress via a toast or a lightweight page-level indicator

## Out of Scope

- Modifying the job processor, automation logic, or SiRADIG navigators
- Adding new job types or changing job payloads
- Changing how ARCA import jobs (`PULL_COMPROBANTES`, `PULL_DOMESTIC_RECEIPTS`) work
- Redesigning the Facturas or Recibos table layouts beyond adding the job status column and expandable detail
