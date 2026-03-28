---
title: Simulador v3 — Category Form UX
status: implemented
priority: high
---

## Summary

Redesign the simulator input experience to maximize the speed to "aha moment." Remove the PDF upload feature (which adds friction and delays the value reveal) and replace the row-based expense table with a structured form where each deduction category is a dedicated field with its annual maximum clearly shown. This lets users quickly input their expenses by category, see how much is deductible, and understand their potential savings — all within seconds of landing on the page.

## Acceptance Criteria

### PDF upload removal

- [ ] Remove the PDF upload dropzone component and all upload-related UI from the simulator
- [ ] Remove the "Agregar" manual entry dialog — categories are now inline fields, not rows
- [ ] Remove the deduction row table/list entirely
- [ ] The `/api/simulador/upload` and `/api/simulador/classify` routes remain untouched (used elsewhere), but are no longer called from the simulator form

### Category form fields

- [ ] **Hijos a cargo** — stepper control (−/+), min 0, max 20 (keep existing stepper)
- [ ] **Cónyuge a cargo** — toggle switch (keep existing)
- [ ] **Alquiler** — amount input, label shows annual max: "$3,091,035/año" (40% of amount deductible, capped)
- [ ] **Prepaga** (Cuotas Médico-Asistenciales) — amount input, label shows "hasta 5% del ingreso neto"
- [ ] **Salud** (Gastos médicos y paramédicos) — amount input, label shows "40% deducible, hasta 5% del ingreso neto"
- [ ] **Educación** (Gastos educativos) — amount input, label shows annual max: "$1,163,862/año"
- [ ] **Intereses préstamo hipotecario** — amount input, label shows annual max: "$20,000/año"
- [ ] **Personal doméstico** — amount input, label shows annual max: "$3,091,035/año"
- [ ] Each amount input accepts **annual amounts** (not monthly), with Argentine peso formatting ($ prefix, thousand separators)
- [ ] Each field shows a subtle hint below with the annual deductible cap or rule
- [ ] Empty/zero fields are valid and simply not included in the calculation

### Form UX

- [ ] Fields are organized in a clean card-based or section-based layout — family situation toggles at the top, then deduction categories below
- [ ] Each category field has a clear label, a brief description of what qualifies, and the max deductible limit
- [ ] The form auto-calculates on every change (no submit button needed) with debounced API calls
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

### Results visibility

- [ ] The annual estimated savings amount gets more visual prominence — larger font size, bolder styling, positioned as the hero metric
- [ ] Show annual savings as the primary figure (not monthly), since inputs are annual
- [ ] Keep the monthly equivalent as secondary text below
- [ ] The ROI card and before/after comparison remain as-is but adapt to the annual-first framing
- [ ] Results update in real-time as the user fills in fields

### Calculation changes

- [ ] The simplified calculator continues using 35% top marginal rate
- [ ] Map form fields to deduction categories: Alquiler → `ALQUILER_VIVIENDA`, Prepaga → `CUOTAS_MEDICO_ASISTENCIALES`, Salud → `GASTOS_MEDICOS`, Educación → `GASTOS_EDUCATIVOS`, Intereses hipotecarios → `INTERESES_HIPOTECARIOS`, Personal doméstico → `SERVICIO_DOMESTICO`
- [ ] The API schema (`simuladorSimplifiedInputSchema`) is updated to accept the new field structure, or the form maps fields to the existing `deducciones` array format before calling the API
- [ ] Family deductions (cónyuge, hijos) continue working as before

## Technical Notes

- **Files to modify**: Primarily `src/components/simulador/simulador-form.tsx` (complete rewrite of the form section), `src/components/simulador/simulador-results.tsx` (annual-first framing), and possibly `src/lib/simulador/schemas.ts` if the input schema changes.
- **Files to delete or stop importing**: `src/components/simulador/pdf-upload-dropzone.tsx` can be left in place but all imports/usage removed from the form. The upload API routes stay untouched.
- **Deduction limits**: Import `DEDUCTION_LIMITS` from `src/lib/simulador/tax-tables.ts` to display annual caps alongside each field. The limits are: `ALQUILER_VIVIENDA: 3,091,035`, `INTERESES_HIPOTECARIOS: 20,000`, `SERVICIO_DOMESTICO: 3,091,035`, `GASTOS_EDUCATIVOS: 1,163,862`. For income-percentage caps (prepaga, salud, donaciones), display "hasta 5% del ingreso neto."
- **Amount inputs**: Use the existing peso-formatted input pattern ($ prefix, thousand separators). All amounts are annual. The form maps each field to the corresponding `DeductionCategory` enum value before sending to the API.
- **Auto-calculation**: Use `useEffect` with a debounce (300-500ms) to call `/api/simulador/calcular` on every form change, similar to the current behavior but triggered by field changes instead of row additions.
- **Mobile-first**: Design for 320px first. Stack all fields vertically. Use `sm:`/`md:` breakpoints for wider layouts. Minimum 44px touch targets on toggles and steppers.
- **Design**: Follow existing Jony Ive-inspired aesthetic — clean whites, `border-gray-200`, generous whitespace. Each category field could be a minimal card or a clean form group with label + input + hint text.

## Out of Scope

- Adding new deduction categories beyond the 8 specified
- Changing the tax calculation engine or the 35% simplified rate assumption
- User authentication or saving simulator results
- Modifying the OCR pipeline or upload API routes
- Changes to the dashboard simulator (if one exists for authenticated users)
- A/B testing between old and new form
- The `esPropietario` toggle (mortgage interest is now a direct amount field)
- Union dues (`incluyeSindicato`) toggle — not included in the new form
