---
title: Support Chat Automation Job Lookup
status: implemented
priority: high
---

## Summary

When users contact support about a failed automation, the AI assistant currently has no visibility into their actual job data — it can only ask the user to describe the problem. This feature adds a new AI tool that queries the user's failed automation jobs, presents them with enough detail for the user to identify the right one (especially when multiple failures exist), and links the selected job to the created support ticket for developer triage.

## Acceptance Criteria

### AI Tool: Lookup Failed Automations

- [ ] New OpenAI tool `lookup_failed_automations` available to the AI assistant in the chat endpoint
- [ ] Tool queries `AutomationJob` records for the current user where `status = FAILED`, ordered by `createdAt DESC`, limited to the 10 most recent
- [ ] Tool returns for each job: `id`, `jobType`, `errorMessage`, `createdAt`, related entity name (invoice provider name, domestic worker name, presentación description, or employer name as applicable), `fiscalYear`, and `currentStep` (the step where it failed)
- [ ] AI presents jobs to the user in a numbered list with: job type (human-readable Spanish label), related entity, fiscal year, error summary, and date — so the user can identify which failure they need help with
- [ ] If the user has zero failed jobs, the AI informs them no recent failures were found and proceeds with normal support flow
- [ ] If the user has exactly one failed job, the AI presents it and asks for confirmation before creating a ticket
- [ ] If the user has multiple failed jobs, the AI presents the list and asks the user to specify which one(s) they need help with

### Database: Link Ticket to Automation Job

- [ ] New optional field `automationJobId` (String?) on `SupportTicket` model, with a relation to `AutomationJob`
- [ ] When the AI creates a ticket for a failed automation, it includes the `automationJobId` of the job the user confirmed
- [ ] The `create_ticket` tool definition is updated to accept an optional `automationJobId` parameter
- [ ] The `POST /api/soporte` endpoint accepts and stores `automationJobId`
- [ ] The ticket notification email to the developer includes the automation job ID and error message when present

### System Prompt Updates

- [ ] System prompt instructs the AI to proactively call `lookup_failed_automations` when the user mentions automation problems, errors, or failed submissions
- [ ] System prompt instructs the AI to always confirm with the user which specific job they mean before creating a ticket, especially when multiple failures exist
- [ ] System prompt provides human-readable Spanish labels for all `JobType` enum values (e.g., `SUBMIT_INVOICE` → "Envío de factura a SiRADIG")

## Technical Notes

### AI Tool Implementation

- Add the `lookup_failed_automations` tool definition in `src/lib/soporte/system-prompt.ts` alongside existing tools (`create_ticket`, `offer_whatsapp`)
- Tool takes no parameters — it implicitly uses the authenticated user's ID from the session
- Query in `src/app/api/soporte/chat/route.ts` tool processing block, using Prisma:
  ```ts
  prisma.automationJob.findMany({
    where: { userId, status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      invoice: { select: { providerName: true, providerCuit: true } },
      domesticReceipts: {
        select: { periodo: true, domesticWorker: { select: { apellidoNombre: true } } },
      },
      presentacion: { select: { descripcion: true } },
      employer: { select: { razonSocial: true } },
    },
  });
  ```
- Map `jobType` to Spanish labels using a lookup object (reuse or mirror labels from `src/lib/automation/job-steps.ts` `JOB_TYPE_STEPS` keys)
- Return a structured summary array the AI can present conversationally

### Schema Migration

- Add to `SupportTicket`:
  ```prisma
  automationJobId String?
  automationJob   AutomationJob? @relation(fields: [automationJobId], references: [id], onDelete: SetNull)
  ```
- Add `supportTickets SupportTicket[]` to `AutomationJob` model
- `onDelete: SetNull` — if the job is deleted (via cascade from invoice/receipt deletion), the ticket retains its text description but loses the direct link

### Existing Tool Update

- Extend `create_ticket` tool parameters to include optional `automation_job_id` (string)
- Update ticket creation logic to store the relation
- Update `sendNewTicketEmail` to include job error details when `automationJobId` is present

### Job Type Labels

Define a `JOB_TYPE_LABELS` map in `src/lib/soporte/system-prompt.ts` or a shared location:

```
SUBMIT_INVOICE → "Envío de factura a SiRADIG"
BULK_SUBMIT → "Envío masivo de facturas"
VALIDATE_CREDENTIALS → "Validación de credenciales ARCA"
PULL_COMPROBANTES → "Importación de comprobantes"
SUBMIT_DOMESTIC_DEDUCTION → "Envío de deducción de servicio doméstico"
SUBMIT_PRESENTACION → "Envío de presentación"
PUSH_FAMILY_DEPENDENTS → "Carga de familiares"
PUSH_EMPLOYERS → "Carga de empleadores"
... (all JobType values)
```

## Out of Scope

- **Retrying failed jobs from chat** — The AI only looks up and reports on failures; retry/re-submit remains a user action from the dashboard.
- **Real-time job monitoring** — The tool queries historical failures, not in-progress jobs.
- **Screenshot display in chat** — Job screenshots (`screenshotUrl`) are not surfaced in the chat UI; the developer can access them via the linked `automationJobId`.
- **Multiple job references per ticket** — A ticket links to at most one automation job. If the user has multiple related failures, separate tickets should be created or the description should cover all.
- **Admin ticket view with job details** — No admin UI changes; the developer uses the job ID from the email/DB to investigate.
