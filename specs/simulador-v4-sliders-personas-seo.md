---
title: Simulador v4 — Sliders, Persona Presets, and /simulador SEO Page
status: implemented
priority: high
---

## Summary

Redesign the landing-page simulator to deliver the "wow moment" within seconds of the first interaction: replace the existing peso-input form with a tactile slider-based UI (one card per category, color-coded icon, real-time deduction badge) and add a row of **persona preset pills** at the top — clicking _"Familia tipo"_ or _"Soltero inquilino"_ instantly populates plausible defaults so a first-time visitor sees a large recovery number without typing anything. Restructure the results into a sticky panel (right column on desktop, top hero on mobile) showing the estimated annual return, a per-category breakdown with `base × 35%`, plan cost subtraction, and final net figure — matching the screenshots exactly. Then add a dedicated `/simulador` route with the same calculator wrapped in SEO content (intro copy, FAQ block with `FAQPage` schema, intent-rich H1) targeting _"simulador ganancias 2026"_ and adjacent long-tail queries, since today the calculator only lives in a hash-anchored section of the homepage and does not earn its own ranking signal. [Lenny: Elena Verna — wow moment over aha moment for new categories] [Lenny: Amol Avasare — solving the cold-start problem with smart defaults] [Lenny: Ethan Smith — topic-targeting & AEO long-tail capture]

## Acceptance Criteria

### Persona presets

- [ ] A horizontal pill row at the very top of the form labeled "Empezá con un ejemplo" (or similar) showing 4–5 persona presets:
  - **Soltero inquilino** — 0 hijos, sin cónyuge, alquiler $450k/mes, prepaga $60k/mes
  - **Familia tipo** — 1 hijo, cónyuge a cargo, alquiler $450k/mes, prepaga $85k/mes, salud $12k/mes
  - **Familia con casa propia** — 2 hijos, cónyuge a cargo, intereses hipot. $300k/mes, prepaga $120k/mes, personal doméstico $250k/mes
  - **Profesional con hijos en colegio privado** — 2 hijos, cónyuge a cargo, prepaga $150k/mes, educación $200k/mes
  - **Personalizado** — clears all fields back to zero
- [ ] Each pill is selectable (click toggles selection). Selecting a preset overwrites all current values (toggles, hijos counter, all 6 sliders) instantly with no confirmation dialog
- [ ] On first page load, **"Familia tipo"** is preselected so the results panel shows a large recovery number immediately — no empty state — delivering the wow moment within the first second [Lenny: Elena Verna — wow moment over aha moment]
- [ ] Selected pill has a distinct visual treatment (filled background or ring); unselected pills are outline-only
- [ ] As soon as the user manually changes any value (slider, toggle, hijos counter), the selected pill state clears (or switches to "Personalizado")
- [ ] Pill row scrolls horizontally on mobile (no wrap) with subtle edge fade indicating more options

### Slider-based deduction cards

- [ ] Each of the 6 deduction categories renders as its own card with: colored icon (Home/HeartPulse/Stethoscope/GraduationCap/Key/Sparkles), category name, deductibility hint (e.g., _"40% deducible"_ or _"100% deducible"_), live `+$XXXk` deduction badge in green, current monthly amount as large number with `$` prefix and thousand separators, slider control, and (separately or as the same number) an editable numeric input
- [ ] Slider range: **$0 to $10.000.000 per month** for all 6 categories. Step: $1.000 (or sensible step that feels smooth)
- [ ] Category-to-color mapping (matches screenshots): Alquiler → purple, Prepaga → red/pink, Salud → blue, Educación → amber, Intereses hipot. → emerald, Personal doméstico → indigo. Slider track and badge use the same hue
- [ ] Numeric input: clicking the displayed amount turns it into an editable input (or the input is always present alongside). Typing updates the slider position and recalculates instantly. Accepts only digits; formats with thousand separators on blur
- [ ] The Mensual/Anual toggle is **removed**. All amounts are monthly. The calculator continues multiplying by 12 internally
- [ ] The deduction badge (`+$756k`, `+$357k`, etc.) shows the **annual deductible amount** (not monthly) for that category, rounded to nearest k or M, computed via `applyDeductionRules()` so per-category caps and rates are reflected accurately
- [ ] When a category amount is $0, the card is dimmed (lower opacity on icon and slider color) and the badge is hidden; sliders still occupy their normal space — they are never collapsed or hidden
- [ ] All 6 cards are always visible — no progressive disclosure, no "+" buttons to add categories — on both desktop and mobile

### Family situation block

- [ ] Family situation card sits above the 6 deduction cards (matches desktop screenshot: "TU SITUACIÓN" header, Hijos a cargo stepper, Cónyuge a cargo toggle on the same row separated by a thin vertical divider on desktop)
- [ ] Hijos stepper: existing −/+ pattern, min 0, max 20
- [ ] Cónyuge toggle: existing Switch component
- [ ] On mobile, family card stays full-width below the sticky hero and above the deduction cards

### Results panel — desktop

- [ ] Two-column layout above 768px (`md:`): left column = persona pills + family card + 6 deduction cards; right column = results panel
- [ ] Right results panel is `position: sticky; top: <navbar height + spacing>;` so it stays visible while the user scrolls or adjusts sliders
- [ ] Results panel content (top to bottom):
  1. Header row: `✦ DEVOLUCIÓN ESTIMADA` (left, primary blue, small caps, tracking) and `F.572 · YYYY` (right, muted, where YYYY is the current fiscal year — see Technical Notes)
  2. Hero amount: gross annual savings as a very large bold number (`$1.133.160` style), no decimals
  3. Subtitle: `≈ $XX.XXX por mes` (gross / 12) and a green pill badge `↗ Nx el plan` where N = `floor(gross_annual / plan_cost_annual)`
  4. Thin divider, then `DESGLOSE` small caps header
  5. Per-category breakdown rows for each non-zero category: colored icon, category name, `base $X.XXM × 35%` subtitle (where base = annual deductible amount post-rules), and `+$XXX.XXX` aligned right
  6. Thin divider
  7. `Costo Plan Personal` row with `−$71.988` aligned right (`PERSONAL_PLAN_MONTHLY_COST × 12`)
  8. `Ganancia neta anual` row, bold, with the net amount in green
  9. Primary CTA button full width: `Empezá a recuperar $X.XXX.XXX →` (where amount is the net annual figure rounded to closest sensible unit) linking to `/login`
  10. Trust signals row below CTA: `✓ 30 días gratis  ✓ Sin tarjeta  ✓ Cancelás cuando quieras`
- [ ] Footer row spanning both columns at the very bottom: small muted text `Estimación informativa. La devolución exacta depende de tu liquidación anual del SiRADIG / F.572.` on the left, `Cifras YYYY oficiales · Sin afiliación a ARCA` on the right
- [ ] All numbers animate smoothly when they change (reuse existing `AnimatedNumber` / `AnimatedRatio` pattern)

### Results panel — mobile

- [ ] Below 768px, layout collapses to single column. Order: sticky hero card on top → family situation card → 6 deduction cards → footer note → sticky bottom CTA
- [ ] Sticky hero card: `position: sticky; top: 0;` with subtle elevation/blur background. Content: `✦ RECUPERÁS` label, hero amount in large bold (`$1.113.000` style), `/año` suffix, `≈ $XX.XXX por mes` subtitle, and `↗ Nx` green pill badge
- [ ] Sticky hero remains visible while the user scrolls down through the slider cards — this is the mobile equivalent of the desktop sticky right panel
- [ ] Sticky bottom CTA: `position: sticky; bottom: 0;` full-width button labeled `Recuperar $X.XXM →` (rounded to nearest 0.01M) linking to `/login`. Below the button: small muted text `30 días gratis · sin tarjeta`
- [ ] When all amounts are $0 (user explicitly cleared via "Personalizado"), hero shows a friendly empty state ("Movés un slider para ver tu devolución") and the bottom CTA is disabled or hidden
- [ ] Per-category breakdown (the desktop "DESGLOSE" section) is **not** shown in the mobile sticky hero — keep the mobile hero compact. Users can scroll through their slider cards to see per-category badges instead

### `/simulador` route (new SEO page)

- [ ] Create route at `src/app/(public)/simulador/page.tsx` rendered with the existing public layout (Navbar + LandingFooter)
- [ ] Page structure:
  1. SEO H1: `Simulador de Ganancias 2026 · Calculá cuánto podés recuperar` (or similar — the H1 must contain the year and "simulador" verbatim for keyword match)
  2. Subhead paragraph (~2–3 sentences): explains what the simulator does, mentions F.572 / SiRADIG / ARCA, reassures users that no signup or data is required to use it
  3. Embedded simulator (same `SimuladorForm` component, same persona presets, same sliders, same results panel)
  4. Below the simulator: a "¿Cómo funciona?" section with 3–4 paragraphs covering: which expenses are deductible (alquiler, prepaga, salud, educación, intereses hipotecarios, personal doméstico) with brief eligibility notes, how the 35% top-bracket assumption works, what F.572 / SiRADIG is, and how the platform automates the filing
  5. FAQ section with at least 8 questions targeting long-tail queries [Lenny: Ethan Smith — topic targeting, one page → many keywords]: e.g., _"¿Qué gastos puedo deducir de Ganancias en 2026?"_, _"¿Cuánto se puede deducir por alquiler?"_, _"¿La prepaga es deducible?"_, _"¿El servicio doméstico se puede deducir?"_, _"¿Cómo se presenta el F.572?"_, _"¿Hasta cuándo tengo tiempo para presentar el SiRADIG?"_, _"¿Necesito guardar las facturas?"_, _"¿Cuánto cuesta usar desgrava.ar?"_
  6. CTA section at the bottom: same "30 días gratis · Sin tarjeta · Cancelás cuando quieras" trio, one large primary button to `/login`
- [ ] FAQ block emits `FAQPage` JSON-LD structured data (`<Script type="application/ld+json">`) for Google rich results and AI engine citation [Lenny: Ethan Smith — AEO]
- [ ] Page emits explicit metadata via Next.js `generateMetadata` or static `metadata` export:
  - `title`: `Simulador Ganancias 2026 · Calculá tu devolución | desgrava.ar`
  - `description`: ~155-char marketing copy mentioning F.572, deducciones, SiRADIG, and "gratis sin registro"
  - `openGraph` with same title + description, image: existing OG image
  - `alternates.canonical`: `https://desgrava.ar/simulador`
  - `keywords`: `["simulador ganancias 2026", "deducciones ganancias", "F.572", "SiRADIG", "calculadora ganancias", "deducir alquiler ganancias", "ahorro impuesto ganancias"]` (kept short and honest)
- [ ] Add `/simulador` to `src/app/sitemap.ts` (or wherever the sitemap is generated) and ensure it's not blocked in `robots.txt`
- [ ] Update the homepage hero CTA (`<a href="#simulador">Calculá tu ahorro</a>`) to link to `/simulador` so click-throughs from the homepage also surface the SEO page (or keep both — see Out of Scope decision)
- [ ] The homepage `#simulador` section continues to render the same `SimuladorForm` (no behavior change there — the SEO page is additive)

### Calculation behavior

- [ ] No changes to `simulateSimplified()` math — same 35% top-rate assumption, same `applyDeductionRules()` per-category caps, same `PERSONAL_PLAN_MONTHLY_COST = 5999` plan cost subtraction
- [ ] Frontend continues converting monthly slider values × 12 before calling the calculator (since calculator expects annual amounts in `deducciones[].amount`)
- [ ] All recalculation happens client-side via direct call to `simulateSimplified()` (already in use by the form) — no API round-trip needed for slider drag responsiveness
- [ ] Per-category badges (`+$756k`) are computed from the same `applyDeductionRules()` output already returned in `result.detalleDeduciones`, eliminating duplicated logic

### Mobile responsiveness

- [ ] All UI works on screens as narrow as 320px, mobile-first
- [ ] Sliders use full available width with 44px+ thumb hit area for accurate touch
- [ ] Sticky hero on mobile does not exceed 30% of viewport height — content below remains scrollable and reachable
- [ ] Sticky bottom CTA respects iOS safe-area insets (`pb-[env(safe-area-inset-bottom)]`)
- [ ] Persona pill row scrolls horizontally without clipping; first pill is fully visible without horizontal scroll required

## Technical Notes

- **Files to modify**:
  - `src/components/simulador/simulador-form.tsx` — restructure layout (persona pills + family card + 6 slider cards), remove Mensual/Anual toggle, replace `PesoInput` with `SliderCard` (slider + numeric input + badge + icon), preselect "Familia tipo" preset on mount
  - `src/components/simulador/simulador-results.tsx` — restructure into the desktop sticky panel design with per-category breakdown rows; the existing `AnimatedNumber`/`AnimatedRatio` helpers stay
  - `src/components/landing/simulador-embed.tsx` — minor wrapper changes for two-column layout on `md+` and single-column with sticky hero on mobile

- **Files to create**:
  - `src/app/(public)/simulador/page.tsx` — new SEO route with metadata export, FAQ JSON-LD, and embedded `SimuladorEmbed`
  - `src/components/simulador/persona-presets.tsx` — pill row component, exports `PersonaPreset` type and `PERSONA_PRESETS` array
  - `src/components/simulador/slider-card.tsx` — single deduction card (icon + label + slider + numeric input + badge), with hue prop
  - `src/components/landing/simulador-faq.tsx` — FAQ accordion + JSON-LD emitter, used by `/simulador` page

- **Persona preset shape**:

  ```ts
  type PersonaPreset = {
    id:
      | "soltero-inquilino"
      | "familia-tipo"
      | "familia-casa-propia"
      | "profesional-hijos-colegio"
      | "personalizado";
    label: string;
    tieneHijos: number;
    tieneConyuge: boolean;
    montos: Partial<Record<DeductionCategoryKey, number>>; // monthly amounts
  };
  ```

  Place in `src/lib/simulador/personas.ts` (alongside `tax-tables.ts`) — pure data, easy to test.

- **Slider component**: use the existing shadcn `Slider` (`@/components/ui/slider`). Wrap with a synced numeric input (controlled by the same state). Debounce slider drags to ~60fps for the recalculation; numeric input updates on `onChange` directly.

- **Sticky panel**: desktop uses `md:sticky md:top-24 md:self-start` on the right column. Mobile uses `sticky top-0 z-30` on the hero card with backdrop blur for legibility over slider content scrolling underneath.

- **Color tokens** (Tailwind, must work in dark mode):
  - Alquiler: `purple-500`/`purple-100`
  - Prepaga: `rose-500`/`rose-100`
  - Salud: `sky-500`/`sky-100`
  - Educación: `amber-500`/`amber-100`
  - Intereses hipot.: `emerald-500`/`emerald-100`
  - Personal doméstico: `indigo-500`/`indigo-100`

- **Fiscal year handling**: the screenshot shows `F.572 · 2025`. Today is 2026-05-03 (per memory), so users are filing for fiscal year 2026 (annual reconciliation happens in March 2027). However, `TAX_TABLES_2025` is still the only published table. **Decision**: display the current fiscal year (2026) in the UI labels — `F.572 · 2026`, `Simulador Ganancias 2026`, `Cifras 2026 oficiales` — but compute with `TAX_TABLES_2025` until 2026 tables are published. Add a `FISCAL_YEAR_DISPLAY` constant in `tax-tables.ts` (set to 2026) for SEO/UI labels, separate from the actual table values. When 2026 tables drop, only the table file changes.

- **SEO content sourcing**: write the FAQ answers and the "¿Cómo funciona?" copy in plain factual Spanish — do not invent regulatory specifics. Cite the AFIP/ARCA limit numbers from `TAX_TABLES_2025.deductionLimits` so they stay in sync with the calculator. Avoid keyword-stuffing — Google penalizes thin content [Lenny: Ethan Smith — 19 of 20 landing pages drive zero traffic; quality > quantity].

- **JSON-LD safety**: render via `<Script id="simulador-faq-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />` in the page server component. Validate with Google's Rich Results Test before merging.

- **Sitemap**: project doesn't appear to have a `sitemap.ts` yet — if so, create one as part of this work covering `/`, `/simulador`, `/terminos`, `/privacidad`, `/cookies`. Honor `lastModified` from file mtime or hardcode.

- **Tests** (per testing mandate for new `src/lib/` modules):
  - `src/lib/simulador/__tests__/personas.test.ts` — assert each preset's monto totals produce a positive `simulateSimplified()` result (non-zero `ahorroAnualHasta`), and that selecting "Personalizado" zeroes out everything
  - Existing calculator tests stay green — no math changes

- **Mobile-first**: design at 320px first. Sliders' thumb is 44px touch target. Persona pills are at least 44px tall. Numeric input has `inputMode="numeric"` for the iOS numeric keyboard.

- **Design**: stay within the existing Jony Ive-inspired palette — clean whites, `border-gray-200`, generous whitespace. The colored category icons are the only saturated color in the form; everything else stays neutral.

## Out of Scope

- Changing the underlying tax calculation engine, the 35% top-rate assumption, or `applyDeductionRules()` logic
- Publishing 2026 tax tables — we keep `TAX_TABLES_2025` until ARCA publishes; only the displayed year label changes
- Authentication, persistence of simulator state across sessions, or saving simulator results to the user's account
- A/B testing infrastructure between v3 (current) and v4 (new) layouts — single hard cutover
- Per-category preset pills _inside_ each category card (e.g., "$300k / $450k / $650k" next to Alquiler) — only persona presets at the top
- Adding new deduction categories beyond the 6 already supported
- Fully programmatic SEO (e.g., 100 generated location pages like `/simulador/buenos-aires`) — only the single `/simulador` page is in scope; fan-out can be a future spec [Lenny: Ethan Smith — programmatic SEO]
- Answer Engine Optimization beyond the FAQ JSON-LD — full AEO strategy (citation tracking, content rewrites for ChatGPT/Claude visibility) is a separate effort
- Dynamic OG images for `/simulador` — reuse the existing static one
- Updating the rest of the homepage layout, the bento grid, pricing section, or reviews carousel
- Sharing or "send to a friend" functionality on the simulator
- Localization beyond Argentine Spanish; the simulator stays AR-only
