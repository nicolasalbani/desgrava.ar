---
title: Conversion-Focused Landing Hero
status: implemented
priority: high
---

## Summary

The current landing hero leads with a strong emotional headline ("Recupera la plata que ganancias te saca") but the subhead is vague ("Miles de pesos en deducciones se pierden cada año porque cargarlas en SiRADIG es un dolor de cabeza"), the CTAs leave too much unsaid, and the above-the-fold space lacks any specific number, trust signal, or trial reassurance. For a paid B2C product targeting Argentine taxpayers — who think in concrete pesos, react to fiscal-year deadlines, and worry about giving credentials to a third party — vague copy and undifferentiated CTAs are the largest cheap conversion lever we have. This feature keeps the emotional headline (it's the strongest part of the current page) and rewrites everything around it: a concrete one-line subhead, a sharper trial CTA, a thin trust strip below the CTAs, and a conditional urgency line during the F.572 cutoff window. [Lenny: Jason Cohen — "the same product can charge 8× by talking about it differently"; Elena Verna — value prop must be visible in seconds, not paragraphs]

## Acceptance Criteria

### Headline (sharpened, not replaced)

- [ ] Headline keeps the emotional shape but fixes voseo: **"Recuperá la plata"** on line 1 and **"que Ganancias te saca"** on line 2 (existing primary-blue gradient on line 2 stays)
- [ ] Capitalize "Ganancias" — it's the proper-noun name of the tax (Impuesto a las Ganancias), not the common noun "ganancias"
- [ ] No other change to headline typography, sizing, or animation

### Subhead (rewritten)

- [ ] Subhead reads: **"Cargamos tus alquileres, gastos médicos, educación y empleadas en SiRADIG por vos. En 10 minutos. Sin contadores."** — three short beats separated by periods, max ~140 characters
- [ ] No "miles de pesos", no "dolor de cabeza", no rhetorical hooks — must contain at least one concrete number (10 minutes) and one explicit deduction-category list
- [ ] Subhead stays in its existing `<FadeIn delay={150}>` wrapper with current typography

### Trust strip (new)

- [ ] A thin one-line trust strip appears between the CTA stack and the reviews carousel, with three icon-text pairs separated by middle dots: `Datos cifrados · Listo en 10 minutos · Hecho en Argentina`
- [ ] Icons come from `lucide-react` (`Lock`, `Zap`, `MapPin`) sized `h-3.5 w-3.5`, paired with text in `text-muted-foreground text-xs`
- [ ] On mobile (<sm) the three pairs stack vertically; at `sm+` they sit on one line with `gap-x-6 gap-y-2`
- [ ] Wrapped in a new `<FadeIn delay={375}>` so it animates between CTAs (delay 300) and reviews (delay 450)
- [ ] Uses semantic tokens only — no raw color classes

### CTAs

- [ ] Primary CTA label changes from "Empeza gratis" to **"Probá 30 días gratis"** with the same `ArrowRight` icon. Voseo correction: "Empeza" → would be "Empezá" but the duration framing wins; ship "Probá 30 días gratis"
- [ ] Below the primary CTA, in `text-muted-foreground text-xs text-center mt-1`, a reassurance line: **"Sin tarjeta de crédito · Cancelás cuando quieras"**
- [ ] The reassurance line sits inside the same `<FadeIn delay={300}>` block as the CTAs
- [ ] On mobile (<sm), where CTAs stack, the reassurance line sits below both buttons (full width)
- [ ] On desktop (sm+), where CTAs sit side-by-side, the reassurance line spans below both
- [ ] Secondary CTA "Calcula tu ahorro" → **"Calculá tu ahorro"** (voseo fix only — same href, same styling)

### Fiscal-year urgency line (conditional)

- [ ] Between January 1st and March 31st (inclusive) of the current calendar year, a single line appears between subhead and CTAs: **"⏳ El F.572 vence el 31 de marzo. Falta poco."** — styled `text-amber-700 dark:text-amber-400 text-sm font-medium`
- [ ] Outside that window the line does not render (no DOM, no extra spacing)
- [ ] The hourglass emoji is fine — it's a single Unicode character, not a custom asset
- [ ] Wrapped in its own `<FadeIn delay={225}>` so it animates between subhead (150) and CTAs (300)
- [ ] Date check is server-side: `LandingPage` is an RSC, so use `new Date()` directly — no client `useEffect`, no hydration flash

### Mobile responsiveness

- [ ] All new copy fits within the existing `max-w-5xl` container at 320px width without truncation
- [ ] Headline keeps its `text-4xl md:text-5xl lg:text-6xl` ramp; subhead keeps `text-lg`; trust strip uses `text-xs`
- [ ] Trust strip stacks vertically on mobile (`flex-col sm:flex-row`)
- [ ] CTAs continue to stack vertically on mobile; the reassurance line sits centered below both
- [ ] All touch targets ≥ 44px (existing `size="lg"` already satisfies this)

### Dark mode

- [ ] All new copy uses semantic tokens (`text-foreground`, `text-muted-foreground`, `text-primary`) — no raw `text-gray-*` or `text-blue-*` classes
- [ ] Amber urgency line uses paired variants (`text-amber-700 dark:text-amber-400`)
- [ ] Trust strip icons inherit `text-muted-foreground` so they auto-adapt

## Technical Notes

- **Single file**: all changes live in `src/app/page.tsx`. No new components, no new business logic, no DB changes, no API routes.
- **Server component**: `LandingPage` is already an RSC, so the fiscal-year date check runs at request time — no `useEffect`, no hydration guards. A simple inline `const isCutoffWindow = (() => { const m = new Date().getMonth(); return m >= 0 && m <= 2; })()` is enough.
- **Voseo throughout**: the project already uses voseo elsewhere (`Empezá`, `Probá`, `Cancelás`, `Recuperá`, `Calculá`). The current landing has two non-voseo verbs (`Recupera`, `Calcula`, `Empeza`) — fix all three for consistency.
- **Spanish punctuation**: the urgency line uses an em-dash–free style (`vence el 31 de marzo. Falta poco.`) because the existing site uses periods for short beats.
- **No A/B testing infra**: at zero paying users this is premature. Ship one version, measure with the existing Umami funnel events from `0-to-1000-users-growth-plan.md`, iterate. [Lenny: positioning carries 8× the impact of price tweaks — get the copy right before you split traffic]
- **Trust strip rationale**: the three pillars address the specific objections Argentine taxpayers raise — security ("Datos cifrados" reassures users handing over ARCA credentials), effort ("Listo en 10 minutos" anchors the time cost vs. a contador or doing it manually), and locality ("Hecho en Argentina" — Argentine SaaS rarely says this, but for a credentials-handling product targeting only AR users it closes the trust gap that US-based fintechs leave open). [Lenny: Elena Verna — value prop has to land in 10 seconds; trust strip pays for itself if even 1 in 100 visitors needs that reassurance]
- **Why "30 días" over "gratis"**: "gratis" alone in Argentina carries promo-spam connotations. A specific duration with "sin tarjeta" reassurance is more credible — and the 30-day trial is the actual product offer per `src/lib/subscription/plans.ts`.
- **Mobile-first**: design is already mobile-first; only the trust strip needs `flex-col sm:flex-row` plus existing breakpoints.
- **No new images, no logo wall, no testimonial card on hero**: the existing `ReviewsCarousel` lives below the hero and stays there. Hero stays text-only and fast to render.

## Out of Scope

- Rewriting the rest of the landing page (How It Works, Features Bento, Simulador embed, Pricing section, Reviews carousel, Footer) — separate copy work
- The user-share artifact ("Compartí tu ahorro") from the 0-to-1000 spec — separate feature
- A/B testing infrastructure, GrowthBook, statistical significance testing, or split-traffic — premature at zero users
- Multilingual support — desgrava.ar is Spanish-only and AR-only
- New image, illustration, or video hero — text-only hero stays
- Changing the navbar, footer, or section dividers
- Updating the `/simulador` page hero (different surface, separate spec)
- Changing any logged-in dashboard copy
- SEO meta tags, OpenGraph image, social share preview cards
- New analytics events for the trust strip or the reassurance line (the existing funnel events cover signup-conversion measurement)
