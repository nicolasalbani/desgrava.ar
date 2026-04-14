---
title: Histogram Show Only Elapsed Months
status: implemented
priority: low
---

## Summary

The dashboard metrics histogram ("Evolución mensual por categoría") currently renders all 12 months of the fiscal year, leaving future months as empty bars that waste space and make the chart harder to read. Since the dashboard always shows the current fiscal year, the histogram should only display months from January through the current month, making the chart denser and more informative.

## Acceptance Criteria

- [ ] The stacked bar chart only renders bars for months 1 through the current month (e.g., in April it shows Ene–Abr)
- [ ] The month labels below the chart match the rendered bars (no future month labels)
- [ ] The cumulative line still renders correctly across the reduced month range
- [ ] The chart `chartMax` scaling uses only actual data (no projected averages for future months)
- [ ] The projection logic (average monthly fill for future months) is removed since future months are no longer rendered
- [ ] On January 1st, only one month (Ene) is shown — the chart still renders correctly with a single bar
- [ ] All bars use the full available width (flex-1 within the container), so fewer months = wider bars
- [ ] Mobile responsiveness is preserved — chart works on screens as narrow as 320px

## Technical Notes

- **Component**: `src/components/dashboard/metrics-panel.tsx` — this is the only file that needs changes.
- **Bar generation** (line ~166): Change `Array.from({ length: 12 }, ...)` to `Array.from({ length: currentMonth }, ...)` where `currentMonth` is already computed on line ~183 as `new Date().getMonth() + 1`.
- **Month labels** (line ~452): Slice `MONTH_NAMES` to `MONTH_NAMES.slice(0, currentMonth)` instead of mapping all 12.
- **Cumulative calculation**: Simplify the `cumulativeMonths` memo — remove the `avgMonthly` projection branch since all months in the array are now actual months. The `projectedStartIndex` concept is no longer needed.
- **Chart max**: `chartMax` can simply be `Math.max(...cumulativeMonths, 1)` since there are no projected values to exclude.
- **Cumulative line X positions**: Update the `xPct` calculation from `((i + 0.5) / 12) * 100` to `((i + 0.5) / currentMonth) * 100` so dots align with the (now wider) bars.
- The dashboard page (`src/app/(dashboard)/dashboard/page.tsx`) always sets `fiscalYear = new Date().getFullYear()`, so this is always the current year — no need to handle past-year "show all 12" logic.
- No new props needed — `currentMonth` is already derived client-side from `new Date()`.

## Out of Scope

- Adding a fiscal year selector to the dashboard (currently always shows current year)
- Showing past complete fiscal years with all 12 months
- Animated transitions when months are added (e.g., on month rollover)
- Changing the chart to a different visualization library
