---
title: Attention counter badges on Facturas and Recibos nav items
status: implemented
priority: medium
---

## Summary

Show a counter bubble (badge) on the Facturas and Recibos navigation items indicating how many items on each page require user attention. This gives users an at-a-glance view of pending work without navigating into each section. The counters update automatically so they always reflect the current state.

## Attention Conditions

### Facturas

An invoice requires attention when **any** of these are true:

- **Not sent to SiRADIG**: no automation job exists for the invoice
- **Failed job**: the latest automation job has status `FAILED`
- **Educational expense missing family member**: `deductionCategory === "GASTOS_EDUCATIVOS"` and `familyDependentId` is null (blocks SiRADIG submission)

### Recibos

A receipt requires attention when **any** of these are true:

- **Not sent to SiRADIG**: no automation job exists for the receipt
- **Failed job**: the latest automation job has status `FAILED`
- **Missing worker assignment**: `domesticWorkerId` is null (blocks SiRADIG submission)

## Acceptance Criteria

- [ ] The sidebar nav item for Facturas displays a small counter badge with the number of invoices needing attention
- [ ] The sidebar nav item for Recibos displays a small counter badge with the number of receipts needing attention
- [ ] Badges also appear on the mobile navigation items
- [ ] Badges are hidden when the count is zero (no badge, not a "0" badge)
- [ ] Counts refresh in real-time when automation job states change (e.g. a job completes or fails) via Server-Sent Events (SSE)
- [ ] Counts also update immediately after the user resolves an attention item locally (e.g. assigns a worker, edits a category) without waiting for a server event
- [ ] The badge uses a style consistent with the existing design system — small, rounded, with a color that draws attention (e.g. `bg-red-500 text-white` or similar)
- [ ] The badge animates smoothly: fades/scales in when appearing, fades/scales out when disappearing, and transitions the count number when it changes
- [ ] Clicking the badge navigates to the corresponding page (`/facturas` or `/recibos`) with a query parameter (e.g. `?filter=attention`) that pre-applies a filter showing only items requiring attention
- [ ] The counter API endpoint responds fast enough to not delay navigation rendering (target < 200ms)

## Technical Notes

### API endpoint

Add a single `GET /api/attention-counts` endpoint that returns both counts in one call:

```json
{
  "facturas": 3,
  "recibos": 1
}
```

The endpoint should run two efficient count queries (not fetch full records):

1. **Facturas**: Count invoices where the user owns them AND (no automation job exists OR latest job status is `FAILED` OR (category is `GASTOS_EDUCATIVOS` AND `familyDependentId` is null))
2. **Recibos**: Count receipts where the user owns them AND (no automation job exists OR latest job status is `FAILED` OR `domesticWorkerId` is null)

Use raw SQL or Prisma's `count` with appropriate `where` clauses for performance. Since "latest job" requires a subquery or join, consider a raw query or Prisma's relation filters.

### UI integration

Create a shared `AttentionBadge` component that accepts a count and renders the bubble. Use it in both `dashboard-sidebar.tsx` and `dashboard-mobile-nav.tsx` next to the Facturas and Recibos labels.

### Real-time updates via SSE

Add a `GET /api/attention-counts/stream` SSE endpoint that emits updated counts whenever an automation job changes state. The job processor should trigger an event after updating a job's status (COMPLETED, FAILED, etc.).

On the client, use an `EventSource` connection to this endpoint. Wrap it in a shared hook/context at the layout level so both sidebar and mobile nav consume the same stream. Include automatic reconnection with exponential backoff if the connection drops.

### Local invalidation

When the user performs a local action that changes attention state (e.g. assigns a worker, edits a category), optimistically update the cached counts immediately without waiting for an SSE event. Use SWR or a React context with a mutate function that components can call after these actions.

## Out of Scope

- Notification badges for other nav items (Trabajadores, Credenciales, etc.)
- WebSocket infrastructure (SSE is sufficient for unidirectional server-to-client updates)
- Breaking down the count by attention reason (e.g. "2 failed, 1 missing worker") — just show the total
- Advanced filter breakdown by attention reason (e.g. separate filters for "failed" vs "not sent" vs "missing data")
