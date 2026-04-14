---
title: Auto-Refresh Dashboard on Job Completion
status: implemented
priority: medium
---

## Summary

The dashboard metrics panel currently shows a static snapshot from the initial page load. When a user triggers an automation job (e.g., pulling comprobantes from ARCA or submitting invoices to SiRADIG) and it completes, the dashboard totals, chart, and counts remain stale until the user manually reloads the page. The panel should automatically refresh its data when relevant automation jobs complete, so the user immediately sees updated deduction totals, submission counts, and chart data without any manual action.

## Acceptance Criteria

- [ ] While automation jobs relevant to dashboard data are in-flight (PENDING or RUNNING), the dashboard polls for their completion
- [ ] When a relevant job transitions to COMPLETED, the dashboard server data is re-fetched automatically (via `router.refresh()`)
- [ ] Relevant job types include: PULL_COMPROBANTES, PULL_DOMESTIC_WORKERS, PULL_DOMESTIC_RECEIPTS, SUBMIT_INVOICE, SUBMIT_DOMESTIC_DEDUCTION
- [ ] Polling only runs when there are active jobs — no unnecessary network requests when idle
- [ ] Polling interval is 3–5 seconds (consistent with existing job polling patterns in the codebase)
- [ ] Multiple concurrent job completions result in a single refresh (debounced), not one per job
- [ ] The refresh is seamless — no full-page flash or scroll position loss (Next.js `router.refresh()` preserves client state)

## Technical Notes

- **Dashboard page** (`src/app/(dashboard)/dashboard/page.tsx`) is a server component — all Prisma queries run here. `router.refresh()` from the client re-executes this server component, which is exactly what's needed.
- **MetricsPanel** (`src/components/dashboard/metrics-panel.tsx`) is the client component that receives server-fetched data as props. Add the polling/refresh logic here since it already has access to `useRouter` patterns (see `dashboard-shell.tsx:32` for existing `router.refresh()` usage).
- **Polling endpoint**: Use `GET /api/automatizacion` (already exists) — it returns recent jobs with their statuses. Filter client-side for relevant job types with PENDING/RUNNING status.
- **Polling lifecycle**: On mount, check for active relevant jobs. If any exist, start a polling interval. When all active jobs reach a terminal status (COMPLETED/FAILED/CANCELLED), trigger `router.refresh()` and stop polling. Re-check on subsequent mounts (React Strict Mode safe).
- **Debounce**: If multiple jobs complete within the same poll cycle, a single `router.refresh()` call handles all of them since it re-fetches all server data.
- **No new API routes needed** — the existing `/api/automatizacion` endpoint returns all the data required to detect job completions.

## Out of Scope

- WebSocket or SSE-based real-time updates on the dashboard (polling is sufficient given the 3–5s tolerance)
- Refresh on invoice manual creation/edit/delete (these happen on separate pages; the dashboard refreshes on next navigation)
- Visual indicator on the dashboard showing "refreshing..." or a loading state
- Refresh of non-dashboard pages (facturas/recibos lists already have their own polling via `usePaginatedFetch`)
