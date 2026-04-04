---
title: Dashboard Metrics Panel
status: implemented
priority: high
---

## Summary

Replace the onboarding tour on the dashboard page with a metrics-driven panel that shows users the tangible value of their deductions. The panel displays monthly deduction totals by category, estimated annual tax savings, submission status overview, and subscription information (plan, trial expiry, billing period). This gives users an at-a-glance understanding of how much money the app is saving them and what's left to deduct.

## Acceptance Criteria

### Metrics section

- [ ] A "Resumen de deducciones" card shows total deducted amount for the current fiscal year (sum of all invoices with `siradiqStatus = SUBMITTED`)
- [ ] An "Ahorro estimado" card shows the estimated annual tax savings, calculated using the existing `simulate()` engine from `src/lib/simulador/calculator.ts` (difference between tax with and without deductions)
- [ ] A "Comprobantes" card shows counts: total invoices, submitted to SiRADIG, and pending
- [ ] A monthly breakdown chart/table shows deducted amounts per month (months 1–12), using data from invoices grouped by `fiscalMonth`
- [ ] A category breakdown shows total deducted per `deductionCategory` (only categories with amount > 0), using the human-readable labels from `CATEGORY_LABELS`

### Subscription section

- [ ] A subscription card shows the current plan name (`Personal` / `Founders`)
- [ ] For `TRIALING` users: shows days remaining until trial expires and the trial end date
- [ ] For `ACTIVE` users: shows next billing date (`currentPeriodEnd`)
- [ ] For `CANCELLED` users: shows access-until date (`currentPeriodEnd`)
- [ ] For `EXPIRED` / `PAST_DUE` users: shows a CTA to subscribe or update payment
- [ ] For `FOUNDERS` users: shows "Acceso permanente" badge

### Layout & design

- [ ] The old `OnboardingTour` component is no longer rendered on the dashboard page
- [ ] The greeting "Hola, [firstName]" remains at the top
- [ ] All cards follow the Jony Ive design: `bg-card`, `border-border`, rounded-2xl, generous padding
- [ ] All new UI works on screens as narrow as 320px — cards stack vertically on mobile, use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for the top metric cards
- [ ] All UI supports dark mode via semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`)

## Technical Notes

- **Dashboard page** (`src/app/(dashboard)/dashboard/page.tsx`): This is a server component. Fetch all metrics data here using Prisma queries (invoices grouped by month/category, counts by status, subscription data) and pass to a client component for rendering.
- **Tax savings calculation**: Use `applyDeductionRules()` from `src/lib/simulador/deduction-rules.ts` to calculate deductible amounts per category, then apply the user's marginal tax rate from `TAX_TABLES_2025`. If the user hasn't run the simulator (no salary data), show the savings at the maximum 35% rate with a note "basado en la alícuota máxima".
- **Subscription data**: Query `Subscription` model directly in the server component (already available via Prisma). Use `resolveCanWrite()` from `src/lib/subscription/access.ts` for status logic.
- **Monthly breakdown**: Use Prisma `groupBy` on Invoice with `fiscalMonth` and `_sum: { amount: true }` filtered by `fiscalYear` and `siradiqStatus: SUBMITTED`. Render as a simple bar chart or horizontal bars using Tailwind (no chart library needed — use `div` bars with percentage widths).
- **Category breakdown**: Use Prisma `groupBy` on Invoice with `deductionCategory` and `_sum: { amount: true }`. Map category keys to labels using `CATEGORY_LABELS` from `src/lib/simulador/deduction-rules.ts`.
- **Monetary formatting**: Use `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })` for all amounts. Use `Decimal.js` for any calculations (existing pattern).
- **Mobile-first**: Top metric cards in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Monthly and category breakdowns stack full-width below. Subscription card full-width at bottom.
- **Remove old code**: Delete `src/components/dashboard/onboarding-tour.tsx` and remove its import from the dashboard page.

## Out of Scope

- Historical year-over-year comparisons (only current fiscal year)
- Interactive charts or chart libraries (use simple Tailwind-based bars)
- Editing invoices from the dashboard
- Running the full simulator from the dashboard (link to `/simulador` instead)
- Push notifications or email alerts about savings milestones
- Exporting metrics as PDF or CSV
