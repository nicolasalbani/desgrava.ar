---
title: Global provider catalog — CUIT, Razon Social, and Deduction Category
status: implemented
priority: high
---

## Summary

A shared, global table (`ProviderCatalog`) that stores CUIT, business name (razon social), and the most likely deduction category for any provider encountered across all users. When a factura is created — manually, via PDF, via email, or via ARCA import — the system checks this catalog first for an instant category suggestion, eliminating per-user "last category" lookups and giving first-time users the same classification quality as returning users.

If the CUIT is not yet in the catalog, the system resolves it through two strategies:

1. **PDF-based**: if the factura has an attached PDF, use the existing AI classifier (`classifyCategory`) on the extracted text.
2. **Web-based fallback**: if there is no PDF, scrape `https://sistemas360.ar/cuit/{cuit}` to get the business activity/description, then pass that text to the AI classifier.

The result is written to the catalog once and reused for all future lookups of that CUIT.

## Acceptance Criteria

- [ ] A new `ProviderCatalog` model exists with fields: `cuit` (unique), `razonSocial`, `deductionCategory`, `source` (how the category was determined), and timestamps
- [ ] When any invoice is created (manual, PDF, email, or ARCA import), the system checks `ProviderCatalog` for the CUIT before running AI classification
- [ ] If the CUIT exists in the catalog, its `deductionCategory` is used as the default — no AI call is made
- [ ] If the CUIT does not exist in the catalog:
  - If the factura has a PDF attachment, classify using the existing AI mechanism on the PDF text, then insert the result into the catalog
  - If there is no PDF, fetch `https://sistemas360.ar/cuit/{cuit}`, extract the business activity/description, classify using AI, then insert the result into the catalog
- [ ] Once a CUIT is in the catalog, it is never overwritten by the automated process (manual admin edits are a separate concern)
- [ ] The existing `/api/facturas/last-category` endpoint is updated: it should first check `ProviderCatalog`, and only fall back to the per-user "last invoice" lookup if no catalog entry exists
- [ ] The ARCA bulk import (`processPullComprobantes`) uses the catalog for classification, avoiding redundant AI calls when the same CUIT appears in multiple invoices within a single import
- [ ] The catalog is global (not per-user) — a category determined from one user's invoice benefits all users

## Technical Notes

### New model

```prisma
model ProviderCatalog {
  id                String            @id @default(cuid())
  cuit              String            @unique
  razonSocial       String?
  deductionCategory DeductionCategory
  source            CatalogSource     @default(AI_PDF)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
}

enum CatalogSource {
  AI_PDF         // classified from invoice PDF text
  AI_WEB_LOOKUP  // classified from sistemas360.ar business info
  AI_INVOICE     // classified from invoice metadata (provider name, type, amount)
  MANUAL         // manually set by admin
}
```

### Classification flow

```
resolveCategory(cuit, invoiceText?, pdfText?):
  1. Check ProviderCatalog for cuit → if found, return category
  2. If pdfText available → classifyCategory(pdfText) → insert catalog entry (AI_PDF)
  3. If invoiceText available (provider name, amount, etc.) → fetch sistemas360.ar/cuit/{cuit}
     → combine business info with invoice text → classifyCategory(combined) → insert catalog entry (AI_WEB_LOOKUP)
  4. Fallback: classifyCategory(invoiceText) → insert catalog entry (AI_INVOICE)
```

### sistemas360.ar scraping

The page at `https://sistemas360.ar/cuit/{cuit}` shows business registration details including activity type (rubro), business name, and tax status. Fetch the page server-side, extract the relevant text (business name, activity description), and pass it to `classifyCategory()` as context. Handle errors gracefully — if the site is down or returns no useful data, fall back to strategy (4).

### Integration points

- **`/api/facturas/last-category`**: check per-user last invoice first, then fall back to `ProviderCatalog`
- **`/api/facturas/route.ts` (POST)**: after creating an invoice, resolve category via catalog if not already set
- **`/api/facturas/upload` (POST)**: same as above, using PDF text when available
- **`processPullComprobantes` in `job-processor.ts`**: build a local cache of catalog lookups for the batch, resolve unknown CUITs once, then reuse for duplicates within the same import
- **Email ingest (`src/lib/email/ingest.ts`)**: use catalog when classifying emailed invoices

### Performance considerations

- During ARCA import (224+ invoices), many will share the same provider CUIT. The catalog eliminates redundant AI calls — only the first occurrence triggers classification.
- The sistemas360.ar fetch should have a reasonable timeout (5s) and should not block the import if it fails.
- Consider batching catalog inserts or using `upsert` with a no-op on conflict to handle race conditions between concurrent imports.

## Out of Scope

- Admin UI to manually edit catalog entries (can be added later)
- Confidence scores or multiple category suggestions per CUIT
- Syncing the catalog with any external tax authority database
