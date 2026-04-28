---
title: Rename /facturas Routes to /comprobantes
status: implemented
priority: low
---

## Summary

Today the comprobantes-deducibles surface lives under `/facturas` (page) and `/api/facturas` (API), with a sidebar label of "Comprobantes deducibles". The Spanish word for what users actually upload is "comprobante" (covers facturas, recibos, notas, tickets, etc.), so the route name `/facturas` is technically wrong — it suggests only invoices. This spec renames every page and API path from `/facturas` to `/comprobantes`, shortens the menu label to "Comprobantes", and updates every internal reference. No data, no behavior, no backwards-compatibility shim — pure rename.

## Acceptance Criteria

### Page routes

- [ ] `src/app/(dashboard)/facturas/` is moved to `src/app/(dashboard)/comprobantes/` (including `page.tsx` and the `nueva/page.tsx` subroute)
- [ ] Visiting `/comprobantes` renders the deducibles list page
- [ ] Visiting `/comprobantes/nueva` renders the manual-entry page
- [ ] Visiting `/comprobantes?filter=attention`, `/comprobantes?intro=1`, and `/comprobantes?spotlight=upload` continues to work as before — same query-param handling
- [ ] Visiting `/facturas` returns Next.js's default 404 (no redirect, per the user's decision)

### API routes

- [ ] `src/app/api/facturas/` is moved to `src/app/api/comprobantes/` — including the index `route.ts`, the `[id]` dynamic segment, and every existing subroute (`bulk-category`, `classify-category`, `last-category`, `upload`)
- [ ] Every `fetch("/api/facturas...")` call site in `src/` is updated to `/api/comprobantes...`
- [ ] No remaining string match for `/api/facturas` in `src/` after the rename

### Sidebar / mobile nav

- [ ] In `src/components/layout/dashboard-sidebar.tsx`, the nav item `{ href: "/facturas", label: "Comprobantes deducibles", icon: FileText }` becomes `{ href: "/comprobantes", label: "Comprobantes", icon: FileText }`
- [ ] Same change in `src/components/layout/dashboard-mobile-nav.tsx`
- [ ] The attention-counter `BADGE_FILTER_OVERRIDES` map in both nav files updates the key from `/facturas` to `/comprobantes` and the value from `/facturas?filter=attention` to `/comprobantes?filter=attention`
- [ ] The "no employers" gating logic that disables the nav item when `!hasEmployers` keeps working — the comparison is updated from `item.href === "/facturas"` to `item.href === "/comprobantes"`
- [ ] The `useAttentionCounts()` return key (`facturas`) and the local destructure name in the nav files **stay as `facturas`** (internal field name, not user-facing — out of scope per "surgical changes")

### Internal references and link updates

- [ ] All `Link href="/facturas..."`, `router.push("/facturas...")`, `redirect("/facturas...")`, and any other string-prefixed `/facturas` references in `src/` are updated to `/comprobantes`. Specific files known from the grep:
  - `src/hooks/use-paginated-fetch.ts`
  - `src/components/facturas/upload-spotlight.tsx`
  - `src/components/facturas/invoice-form.tsx`
  - `src/components/facturas/file-uploader.tsx`
  - `src/components/facturas/invoice-list.tsx`
  - `src/components/dashboard/comprobantes-recientes.tsx`
  - `src/components/onboarding/dashboard-tour.tsx`
  - `src/lib/email.ts`
  - `src/lib/onboarding/proximo-paso-state.ts`
- [ ] The implementer runs a final grep — `grep -rn "/facturas" src/` returns no hits after the rename (with the deliberate exceptions noted under Out of Scope)
- [ ] Same final grep for `/api/facturas` returns no hits

### Tests

- [ ] `src/lib/__tests__/email.test.ts` is updated to assert the new `/comprobantes` URL in any email-body assertions
- [ ] `src/lib/onboarding/__tests__/proximo-paso-state.test.ts` is updated wherever it references `/facturas`
- [ ] Full test suite passes: `npm run test`

### Build / lint / format

- [ ] `npm run lint && npm run format:check && npm run build && npm run test` all pass
- [ ] `npx tsc --noEmit` is clean

## Technical Notes

- **Folder moves**: do these as `git mv` so history is preserved. Two moves total: `src/app/(dashboard)/facturas` → `src/app/(dashboard)/comprobantes`, and `src/app/api/facturas` → `src/app/api/comprobantes`.
- **No DB change**: the Prisma `Invoice` model keeps its name. We're renaming user-facing URLs, not the data model.
- **No component-folder rename**: `src/components/facturas/` and the file names inside (`invoice-list.tsx`, `invoice-form.tsx`, etc.) **stay as-is**. CLAUDE.md tolerates the Spanish/English mix in component names; renaming the folder cascades into ~15 import paths for no user-visible benefit.
- **No variable rename**: identifiers like `facturas`, `invoices`, `invoiceCount`, etc., all stay. The rename is strictly URL-level + menu label.
- **Search recipe** the implementer should run before declaring done:
  ```
  grep -rn '"/facturas\|/facturas?' src/
  grep -rn '"/api/facturas' src/
  ```
  Both should return zero hits except for the deliberate exceptions called out in Out of Scope.
- **CLAUDE.md update**: line 115 enumerates API route paths and includes (implicitly) `/facturas`. Update that line — and any other CLAUDE.md mentions — so future contributors don't see stale paths.
- **No mobile-first / dark-mode work**: rename only touches strings; no new UI surfaces.

## Out of Scope

- Renaming the Prisma `Invoice` model or any DB columns
- Renaming the `src/components/facturas/` directory or any file within it
- Renaming variables, hooks, types, parameters, or context fields that contain the substring `factura` or `invoice` (e.g., `useAttentionCounts().facturas`, the Zod `invoiceSchema`, etc.)
- Backwards-compatible redirects from `/facturas` to `/comprobantes` (the user explicitly opted out)
- Updating any external/landing copy that uses the word "factura" (the landing page, marketing site, support docs)
- Renaming `data-tour="facturas-actions"` selectors or other internal identifiers
- Renaming Telegram or email-template variables that say `facturas`
- Migrating user data, since none exists at zero users
- Touching `/recibos`, `/presentaciones`, or any other dashboard route
