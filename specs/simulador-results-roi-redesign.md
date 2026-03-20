---
title: Simulador Results Card — ROI-Focused Redesign
status: implemented
priority: high
---

## Summary

The simulador results card currently crams three financial figures into a flat hierarchy with a playful emoji, forcing users to do mental math and undermining trust. This redesign restructures the results display to lead with the ROI ratio (the most persuasive metric), break numbers into a scannable visual hierarchy, replace the emoji with a trust signal, and use benefit-oriented CTA copy. The goal is to increase conversion by making the value proposition instantly obvious and trustworthy.

## Acceptance Criteria

### ROI hero metric

- [ ] Display the ROI multiplier as the primary visual element: "Por cada $1 que invertís, recuperás $X" (computed as `ahorroMensual / planCostoMensual`, rounded to nearest integer)
- [ ] When `ahorroMensual` is 0 or net savings are negative, hide the ROI multiplier and show a message like "Agrega gastos deducibles para ver tu ahorro"
- [ ] ROI multiplier uses `AnimatedMoney`-style animated counting for the ratio number

### Visual hierarchy — three-layer number breakdown

- [ ] **Primary line**: Monthly savings amount — large, bold, green: "Hasta $XX.XXX/mes"
- [ ] **Secondary line**: Plan cost clearly separated: "Plan Personal: $4.999/mes"
- [ ] **Tertiary line or badge**: Annual total as a subtle badge or smaller text: "$XXX.XXX/año neto"
- [ ] Each number occupies its own visual line — no concatenation with `·` separators
- [ ] All monetary values use `AnimatedMoney` for smooth transitions

### Before/after comparison card

- [ ] Display a two-column or side-by-side comparison: "Sin desgrava.ar" vs "Con desgrava.ar"
- [ ] "Sin" column shows: "$0 recuperados" (grayed out)
- [ ] "Con" column shows: the net monthly savings (highlighted in green)
- [ ] Visual gap between columns makes the difference tangible at a glance
- [ ] On mobile, stack vertically with a clear divider or arrow between them

### Trust signal replaces emoji

- [ ] Remove the 🤑 emoji entirely
- [ ] Replace with a shield icon (`ShieldCheck` from lucide-react) or checkmark icon in a subtle green tint
- [ ] Alternatively, if user count data is available, show a micro-stat like "XX usuarios ya recuperaron" (hardcoded placeholder is acceptable for now)

### Benefit-oriented CTA

- [ ] Change CTA text from "Empeza a desgravar" to "Quiero ahorrar" or "Activar mi ahorro"
- [ ] Keep the `ArrowRight` icon and link to `/login`
- [ ] CTA button remains visible only when `ahorroMensual > 0`

### Edge cases

- [ ] When net savings (after plan cost) are negative, hide the ROI multiplier and before/after card; show only: "Tus deducciones aún no cubren el costo del plan. Agrega más gastos para ver tu ahorro."
- [ ] When net savings are exactly 0, treat as negative case
- [ ] ROI multiplier should floor to nearest integer (e.g., 14.3x → 14x) — avoid decimal ratios

## Technical Notes

- **File to modify**: `src/components/simulador/simulador-results.tsx` — this is the only file that needs changes. The component already receives `SimplifiedSimulationResult` with all needed data.
- **ROI calculation**: `Math.floor(ahorroMensual / PERSONAL_PLAN_MONTHLY_COST)`. Import `PERSONAL_PLAN_MONTHLY_COST` (already imported).
- **Icons**: Use `ShieldCheck` from `lucide-react` (already a project dependency).
- **Layout**: Use the existing card pattern (`border-border rounded-xl border p-5`) but restructure the inner layout from a single flex row to a stacked layout with the ROI hero on top, number breakdown in the middle, and before/after + CTA at the bottom.
- **Responsive**: The before/after comparison should use `sm:flex-row flex-col` to stack on mobile and sit side-by-side on desktop.
- **No API changes needed** — all data is already available in the result prop.
- **Design system**: Follow existing patterns — `text-green-600 dark:text-green-400` for savings, `text-muted-foreground` for secondary text, `bg-green-50/50 dark:bg-green-950/20` for the card background.

## Out of Scope

- Changes to the simulator calculation logic or API
- Changes to the simulator form inputs
- A/B testing infrastructure
- Analytics or conversion tracking
- Real user count data (placeholder is fine)
- Changes to the landing page layout outside the results card
