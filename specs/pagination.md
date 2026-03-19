---
title: Pagination for Facturas and Recibos
status: implemented
priority: medium
---

## Summary

Add server-side pagination to the Facturas and Recibos pages to improve performance and scalability. Currently both pages fetch the entire dataset on mount and perform all filtering client-side. As users accumulate invoices and receipts, this will degrade load times and memory usage. This feature introduces cursor-based pagination at the API layer, moves filtering to the server, and adds pagination controls to both table UIs.

## Acceptance Criteria

### API Layer

- [ ] `GET /api/facturas` accepts `page` (default 1) and `pageSize` (default 25) query params
- [ ] `GET /api/facturas` accepts `search`, `categories`, `statuses`, `dateFrom`, `dateTo`, `amountMin`, `amountMax` query params for server-side filtering
- [ ] `GET /api/facturas` response includes `{ invoices, pagination: { page, pageSize, totalCount, totalPages } }`
- [ ] `GET /api/recibos` accepts `page` (default 1) and `pageSize` (default 25) query params
- [ ] `GET /api/recibos` accepts `search`, `categories`, `statuses`, `totalMin`, `totalMax`, `contribMin`, `contribMax` query params for server-side filtering
- [ ] `GET /api/recibos` response includes `{ receipts, pagination: { page, pageSize, totalCount, totalPages } }`
- [ ] Both APIs use Prisma `skip`/`take` for offset-based pagination
- [ ] Both APIs return `totalCount` via a parallel `prisma.*.count()` call with the same `where` clause
- [ ] `fiscalYear` filtering remains a server-side query param (already exists for recibos, add for facturas)

### UI — Pagination Controls

- [ ] Both `InvoiceList` and `ReceiptList` render pagination controls below the table
- [ ] Pagination shows: previous/next buttons, current page indicator, total count summary (e.g., "Mostrando 1-25 de 142")
- [ ] Page size selector with options: 10, 25, 50, 100
- [ ] Navigating pages preserves current filter state
- [ ] First page loads by default; changing filters resets to page 1

### UI — Server-Side Filtering

- [ ] Search input debounces (300ms) and triggers a server request instead of client-side filtering
- [ ] Category and status multi-select filters send values as comma-separated query params
- [ ] Date range and amount range filters are sent as query params
- [ ] All filter changes reset pagination to page 1
- [ ] Active filter count badge still works (computed from filter state, not data)

### Polling & Job Status

- [ ] Auto-refresh polling (5s interval for in-flight jobs) continues to work with pagination — re-fetches the current page
- [ ] Attention counter badges in nav still reflect global counts, not just the current page (may require a separate lightweight count endpoint or header)

### Backward Compatibility

- [ ] Bulk actions (submit to SiRADIG, delete, category change) operate on selected items within the current page
- [ ] "Select all" checkbox selects all items on the current page only
- [ ] If fewer results than `pageSize`, pagination controls are hidden or disabled gracefully

## Technical Notes

- Use offset-based pagination (`skip`/`take`) rather than cursor-based — simpler for a UI with page numbers and the dataset sizes won't be large enough for cursor pagination to matter.
- Run `prisma.*.count()` in parallel with `prisma.*.findMany()` using `Promise.all` to avoid sequential round-trips.
- Move the `useMemo` filtering logic from `InvoiceList`/`ReceiptList` to the Prisma `where` clause. The `search` param should use Prisma `contains` (case-insensitive) on `providerName`, `providerCuit`, and `invoiceNumber` (for facturas) or `domesticWorker.apellidoNombre`, `domesticWorker.cuil`, and `periodo` (for recibos).
- Consider extracting a shared `usePaginatedFetch` hook that manages `page`, `pageSize`, filters, debounced search, and polling state — both lists have nearly identical fetch/poll patterns.
- The existing database indexes on `[userId, fiscalYear]` and `[userId, siradiqStatus]` already cover the primary filter paths. A composite index on `[userId, fiscalYear, createdAt]` may help if sorting + year filtering is slow.
- Attention counter badges currently derive from the full dataset. After pagination, either: (a) add a `GET /api/facturas/counts` and `GET /api/recibos/counts` endpoint that returns attention-worthy counts, or (b) include `attentionCount` in the paginated response metadata.
- Pagination UI can use shadcn/ui's `Pagination` component or a lightweight custom component matching the existing design system.

## Out of Scope

- Infinite scroll / virtual scrolling — we're using traditional page-based navigation.
- URL-based filter persistence (query string sync) — filters reset on page reload. Can be added later.
- Sorting by arbitrary columns — current sort order (`createdAt desc` for facturas, `fiscalYear/fiscalMonth desc` for recibos) is preserved.
- Server-side search with full-text search (pg_trgm or similar) — basic `contains` is sufficient for now.
- Paginating the job history panel within each row — these are small datasets per invoice/receipt.
