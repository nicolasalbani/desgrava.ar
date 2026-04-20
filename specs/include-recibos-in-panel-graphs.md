---
title: Include Recibos Salariales in Panel Graphs
status: implemented
priority: medium
---

## Summary

The dashboard panel currently only aggregates `Invoice` rows (comprobantes) in its metrics cards, stacked bar chart, and cumulative line. Domestic salary receipts (`DomesticReceipt`), which are deductible under SiRADIG's "Deducción del personal doméstico" category, are ignored. This makes the "Total deducido", "Ahorro estimado", and monthly chart understate the real deduction when a user has domestic workers. This feature folds recibos salariales into the same aggregations so the panel reflects the full picture of what the user is deducting.

## Acceptance Criteria

### Metric cards

- [ ] "Total deducido" card sums both: (a) invoices with `siradiqStatus = SUBMITTED` and `deductionCategory != NO_DEDUCIBLE` (with `getSiradigEffectiveRate` applied, as today) and (b) `DomesticReceipt.total + DomesticReceipt.contributionAmount` (retribución + aportes) for receipts with `siradiqStatus = SUBMITTED` for the current fiscal year — matching SiRADIG's "Monto Total" column in the Personal Doméstico form
- [ ] "Ahorro estimado" card is derived from the combined `totalDeducted` × 0.35 (no change to the formula, just the input)
- [ ] Existing "Comprobantes" card is unchanged (still counts only invoices)
- [ ] A new "Recibos salariales" card is added next to "Comprobantes", showing: total receipt count, SUBMITTED count ("enviados"), and PENDING/QUEUED/PROCESSING count ("pendientes") — mirroring the invoice card's layout and icons
- [ ] Top metric grid goes from 3 to 4 cards and the layout stays balanced on all breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### Chart

- [ ] Monthly stacked bars include a `SERVICIO_DOMESTICO` segment built from `DomesticReceipt.contributionAmount` grouped by `fiscalMonth` (SUBMITTED only), added on top of any existing `SERVICIO_DOMESTICO` contribution from invoices in the same month
- [ ] The `SERVICIO_DOMESTICO` category appears in the legend/filter row with its existing color (`bg-lime-400/80`) and its total reflects invoices + receipts combined
- [ ] Toggling the `SERVICIO_DOMESTICO` filter in the legend hides both the receipt and invoice contributions for that category (one combined segment, not two)
- [ ] The cumulative line reflects the combined monthly totals
- [ ] When the user has recibos but no invoices, the chart still renders (currently gated on `hasData = totalInvoices > 0`); the gate is generalized to "has any deducible document"

### Empty state

- [ ] The empty-state card copy is updated from "Todavía no tenés comprobantes deducidos. Importalos desde ARCA o subí un PDF." to also mention recibos salariales (e.g. "Todavía no tenés comprobantes ni recibos salariales deducidos. Importalos desde ARCA o cargalos manualmente.")
- [ ] The empty state shows only when both `totalInvoices === 0` and `totalReceipts === 0`

### Responsiveness

- [ ] All changes work on screens as narrow as 320px; 4 cards stack vertically on mobile (`grid-cols-1`), 2×2 on `sm`, 1×4 on `lg`

## Technical Notes

- **Dashboard page** (`src/app/(dashboard)/dashboard/page.tsx`): Add three parallel Prisma queries to the existing `Promise.all`:
  - `prisma.domesticReceipt.count({ where: { userId, fiscalYear } })`
  - `prisma.domesticReceipt.count({ where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" } })`
  - `prisma.domesticReceipt.count({ where: { userId, fiscalYear, siradiqStatus: { in: ["PENDING", "QUEUED", "PROCESSING"] } } })`
  - `prisma.domesticReceipt.groupBy({ by: ["fiscalMonth"], where: { userId, fiscalYear, siradiqStatus: "SUBMITTED" }, _sum: { total: true, contributionAmount: true } })` — only one category (SERVICIO_DOMESTICO), so no need to group by category. Both fields are summed because SiRADIG's deduction = retribución + aportes.
- **Merge into `monthCategoryData`**: After the groupBy, map each receipt-month entry into a `{ month, category: "SERVICIO_DOMESTICO", amount }` entry using `Decimal` (match existing pattern). If the same month already has a `SERVICIO_DOMESTICO` entry from invoices, merge (sum) rather than duplicate, so the chart has at most one segment per month per category.
- **Effective rate / amount**: SiRADIG's Personal Doméstico form deducts the SUM of `total` (retribución, salary paid) + `contributionAmount` (APORTES + CONTRIBUCIONES) per month — that's the "Monto Total" column shown in the form and summed in the F.572 subtotal. Do NOT apply `getSiradigEffectiveRate` to this — pass the sum through as-is.
- **`totalDeducted`**: Since `monthCategoryData` is the sole input for the sum (`src/app/(dashboard)/dashboard/page.tsx:71-74`), merging receipts into that array automatically updates the total and the derived `estimatedSavings`.
- **`MetricsPanel` props**: Extend `MetricsPanelProps` in `src/components/dashboard/metrics-panel.tsx` with `totalReceipts`, `submittedReceiptsCount`, `pendingReceiptsCount`. Pass them from the page.
- **New card**: Duplicate the "Comprobantes" card block, swap the icon to a receipt-appropriate icon from `lucide-react` (e.g. `Receipt` or `ReceiptText`), label to "Recibos salariales", and wire up the three new props.
- **Grid**: Change the top metrics grid class from `sm:grid-cols-2 lg:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4`.
- **Empty state gate**: Change `const hasData = totalInvoices > 0` to `const hasData = totalInvoices > 0 || totalReceipts > 0`.
- **Auto-refresh**: The existing `DASHBOARD_RELEVANT_JOB_TYPES` set already includes `PULL_DOMESTIC_RECEIPTS` and `SUBMIT_DOMESTIC_DEDUCTION`, so auto-refresh on job completion already covers recibos — no change needed.
- **Tests**: No unit tests for `metrics-panel.tsx` exist today (it's a presentational client component), so only manual verification is expected. If any test lives in `src/app/(dashboard)/dashboard/__tests__/`, update it; otherwise none to add.

## Out of Scope

- Separate color for `SERVICIO_DOMESTICO` subdivided by worker (still a single stacked segment per month)
- A distinct legend entry for "Recibos" vs "Comprobantes" in the chart (the chart is organized by category, not by document type)
- Showing the underlying `total` salary (non-deductible portion) anywhere on the panel
- Historical year-over-year comparison that includes recibos
- A new chart specific to recibos (e.g. monthly salary evolution)
- Changes to the Presentaciones or Comprobantes pages
- Changing the existing effective-rate logic for invoices
