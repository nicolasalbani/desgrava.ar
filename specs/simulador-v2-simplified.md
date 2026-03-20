---
title: Simulador v2 — Simplified Savings Calculator
status: implemented
priority: high
---

## Summary

Redesign the landing-page simulador to maximize simplicity and lead the user to the "aha moment" — understanding how much they can save. Remove the salary input (assume top 35% tax bracket for all calculations), always frame savings as "up to" amounts, enrich the invoice list with provider name/CUIT/date/auto-categorization, show per-item deductible amounts, add a property owner toggle, replace the children text input with a stepper/counter, show net savings after deducting the Personal plan cost ($4.999/mo), and remove the detailed breakdown cards.

## Acceptance Criteria

### Inputs removed / simplified

- [ ] Remove "Salario bruto mensual" input entirely — calculator always uses 35% marginal rate (top bracket) to compute savings
- [ ] Replace "Hijos a cargo" text input with a stepper control (−/+) buttons, min 0, max 20
- [ ] Rename "Monto mensual" column label to "Monto"
- [ ] Add "Propietario de inmueble" toggle (Switch) next to the existing Cónyuge and Aporte sindical toggles

### Invoice list enrichment

- [ ] Each invoice row shows: provider name, CUIT, date, category (auto-selected), monto, deductible amount — in that order
- [ ] Source filename is shown only as a tooltip (on a subtle file icon), not as visible text
- [ ] After PDF upload/OCR, auto-populate provider name, CUIT, and date from `ExtractedFields` (already extracted by the OCR pipeline: `cuit`, `providerName`, `date`)
- [ ] Auto-select category: first check `ProviderCatalog` by CUIT (existing DB lookup), then fall back to AI classification if CUIT not found — using the same flow as the dashboard invoice creation
- [ ] For manually added rows, provider name and CUIT are editable text inputs; date defaults to today
- [ ] Show per-item "Deducible" column: display how much of each item's monto is deductible based on its category rules (call `applyDeductionRules` client-side or return from API)

### Property owner deduction

- [ ] When "Propietario de inmueble" is toggled on, include `INTERESES_HIPOTECARIOS` deduction in the calculation (prompt user for monthly mortgage interest amount via a conditional input that appears below the toggle)

### Results display

- [ ] All savings amounts are prefixed with "hasta" (e.g., "Ahorrás hasta $X.XXX/mes")
- [ ] Remove "Desglose del cálculo (mensual)" card entirely
- [ ] Remove "Detalle de deducciones (mensual)" card entirely
- [ ] Keep the green savings hero card with mensual/anual toggle
- [ ] After savings amount, show a line: "Tu ahorro neto después del plan Personal ($4.999/mes): hasta $X.XXX/mes" — computed as savings minus $4.999/mo (or $59.988/yr). If net is negative, show "El plan se paga solo cuando tus deducciones superan $X"
- [ ] "Empezá a desgravar" CTA button is only visible inside the results card (shown after calculation), never before — remove the current always-visible "Registrate para desgravar" link below the form

### Calculation changes

- [ ] Simplify `simulate()` or create a new `simulateSimplified()` that skips salary-based calculation and directly applies 35% marginal rate to total deductible amount to get max savings: `savings = totalDeductible * 0.35`
- [ ] Schema: `salarioBrutoMensual` becomes optional (not sent by simulador v2); API route handles both modes for backwards compat
- [ ] Include property owner mortgage interest in deductions when `esPropietario` is true

### Upload endpoint enhancement

- [ ] Extend `/api/simulador/upload` response to include `category` (auto-resolved via ProviderCatalog or AI) and `providerName`, `cuit`, `date` from OCR fields — currently only returns `amount`
- [ ] New endpoint or extension: `/api/simulador/classify` — accepts CUIT + optional OCR text, returns suggested category from ProviderCatalog or AI

## Technical Notes

- **Calculator simplification**: With top-bracket assumption, savings = `totalDeductible * 0.35`. This avoids needing salary, mandatory deductions, personal deductions, and bracket calculations entirely for the "up to" display. The existing `applyDeductionRules()` still applies per-category caps/rates.
- **OCR fields**: `ExtractedFields` already extracts `cuit`, `providerName`, `date`, `amount` — the simulador form just doesn't use them yet. Wire these through from the upload response.
- **ProviderCatalog lookup**: Reuse `src/lib/catalog/` lookup logic. The catalog stores `cuit → deductionCategory` + `razonSocial`. For the simulador, this means auto-category + provider name for known CUITs.
- **AI classification fallback**: Reuse the OpenAI classification flow from invoice creation (`src/lib/catalog/`). For unknown CUITs without catalog entry, call AI with OCR text + sistemas360 enrichment.
- **Per-item deductible**: Use `applyDeductionRules()` from `src/lib/simulador/deduction-rules.ts` to compute each row's deductible amount. Can be done client-side (import the function) or server-side (extend the API response). Client-side is simpler since deduction rules are pure functions with no DB dependency — but they need the `DeductionLimits` from `tax-tables.ts`.
- **Plan cost**: Hardcode Personal plan price ($4.999/mo) from `pricing-section.tsx` tiers. Consider extracting to a shared constant.
- **Property toggle**: When enabled, show a conditional input for monthly mortgage interest. This maps to `INTERESES_HIPOTECARIOS` category in the deductions array.

## Out of Scope

- Changing the actual tax calculator (`simulate()`) for dashboard use — dashboard users still enter salary for precise calculations
- Multi-period support (the simulador uses current period only)
- User authentication or saving simulador results
- Changing the OCR pipeline or field extraction logic
- Modifying the ProviderCatalog enrichment flow (sistemas360 scraping)
- Mobile-specific responsive redesign beyond what naturally flows from the component changes
