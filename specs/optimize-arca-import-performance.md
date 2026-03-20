---
title: Optimize ARCA Invoice Import Performance
status: implemented
priority: high
---

## Summary

The ARCA invoice import (`PULL_COMPROBANTES`) processes invoices sequentially — each invoice awaits category resolution (OpenAI API call + web lookup per unique CUIT) and an individual database INSERT. For 100 invoices from 50 unique providers, this means ~50 sequential OpenAI calls (~50s) plus 100 sequential DB writes. This spec introduces parallel category resolution, batch database inserts, and concurrent web lookups to dramatically reduce import time.

## Acceptance Criteria

- [ ] Category resolution for unique CUITs runs in parallel with a concurrency limit (e.g., 5-10 concurrent OpenAI calls) instead of sequentially
- [ ] Web lookups (`lookupCuit360` / `lookupCuitOnline`) for different CUITs run in parallel within the same concurrency pool
- [ ] Database writes use `prisma.invoice.createMany()` in batches (e.g., 50 at a time) instead of individual `prisma.invoice.create()` per invoice
- [ ] The import loop is restructured into two phases: (1) resolve all categories in parallel, (2) batch-insert all invoices
- [ ] Progress logging still updates the user at regular intervals during both phases
- [ ] All existing tests continue to pass; no behavioral changes to deduplication, classification, or error handling
- [ ] Import of 100 invoices from 50 unique CUITs completes in under 30 seconds (excluding browser navigation time), down from ~60+ seconds

## Technical Notes

### Phase 1: Parallel Category Resolution

Restructure the import loop in `src/lib/automation/job-processor.ts` (lines 753-808) into two phases:

1. **Collect unique CUITs** from the non-duplicate invoices
2. **Resolve categories in parallel** using `p-limit` or `Promise.allSettled()` with a concurrency cap (suggest 5-8). Each unique CUIT triggers `resolveCategory()` once; results are stored in the existing `categoryCache` Map.

The `resolveCategory()` function in `src/lib/catalog/provider-catalog.ts` already checks the `ProviderCatalog` table first (instant cache hit), so only truly uncached CUITs will trigger web lookups + OpenAI calls. This is safe to parallelize since catalog writes use `upsert` with conflict handling.

### Phase 2: Batch Database Inserts

After all categories are resolved, build the full array of invoice data objects and use `prisma.invoice.createMany()` in chunks (e.g., 50 per batch). This replaces 100 individual `INSERT` statements with 2 batch operations.

Note: `createMany()` doesn't return created records, but we don't need them — we only need the count for progress reporting. Update the `existingKeys` Set after each batch for correctness.

### Progress Logging

- During category resolution phase: log progress as CUITs are resolved (e.g., "Clasificando proveedores: 30/50")
- During batch insert phase: log after each batch (e.g., "Importadas: 50/100")

### Concurrency Library

The project already uses `p-queue` in `browser-pool.ts`. Use `p-limit` (lighter weight, from the same author) for the category resolution concurrency limit, or use native `Promise.allSettled()` with chunked arrays.

### Files to Modify

- `src/lib/automation/job-processor.ts` — Restructure `processPullComprobantes()` import loop into parallel resolve + batch insert
- No changes needed to `provider-catalog.ts`, `category-classifier.ts`, or `csv-parser.ts` — they are already stateless and safe for concurrent use

## Out of Scope

- Browser navigation optimization (networkidle waits in `mis-comprobantes-navigator.ts`) — that's a separate concern tied to ARCA's page behavior
- Increasing `MAX_CONCURRENT` in `browser-pool.ts` to allow parallel jobs across users
- Changes to the AI classification model or prompt
- Caching or pre-warming the provider catalog
- Changes to the SSE log streaming or UI components
