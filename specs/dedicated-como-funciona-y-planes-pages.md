---
title: Dedicated /como-funciona and /planes Pages for SEO
status: implemented
priority: medium
---

## Summary

The home page packs the full product story into a single scroll: hero → `#desgrava` (HowItWorks + FeaturesBento + LandingFaq) → `#simulador` → `#planes` (PricingSection). That's good for conversion once a visitor arrives, but it gives Google a single URL to rank for everything — there's no dedicated surface for queries like "como funciona desgrava.ar", "deducciones SiRADIG paso a paso", "precio desgrava.ar", or "cuánto cuesta desgrava". `/simulador` already proved the pattern works: a dedicated page with its own H1, expanded SEO copy, FAQ + JSON-LD, and a sitemap entry now ranks for simulator-related queries while the home still embeds the form for conversion. This feature replicates that pattern for two more surfaces — `/como-funciona` and `/planes` — keeping the home sections intact (option A) but moving the conversion-objection LandingFaq onto `/como-funciona` so the dedicated page has a stronger SEO body and the home stays focused on flow. Footer and navbar are updated to expose the new pages, with the navbar using anchors when on `/` and hard links elsewhere (the existing `isLanding` ternary pattern). [Lenny: Jason Cohen — the pricing page is one of the few high-leverage conversion checkpoints, worth its own surface]

## Acceptance Criteria

### A. Routes & files

- [ ] New file `src/app/(public)/como-funciona/page.tsx` (server component) renders the dedicated "Cómo funciona" page
- [ ] New file `src/app/(public)/planes/page.tsx` (server component) renders the dedicated "Planes" page
- [ ] Both pages share the existing `(public)/layout.tsx` shell — no new layout, no new route group
- [ ] No new API routes, no DB changes

### B. `/como-funciona` content

- [ ] **`<title>`**: `Cómo funciona desgrava.ar · Automatizá tus deducciones de Ganancias` (≤ 70 chars)
- [ ] **`<meta description>`**: One sentence covering ARCA login → carga de gastos → presentación SiRADIG, ≤ 160 chars
- [ ] **`alternates.canonical`**: `https://desgrava.ar/como-funciona`
- [ ] **OpenGraph**: `type: "website"`, `url`, `title`, `description` set (image inherited from root metadata if present)
- [ ] **Hero**: H1 `Cómo funciona desgrava.ar`, eyebrow `Producto · Automatización ARCA`, intro paragraph (~3 sentences) explaining what the product does end-to-end. Two CTAs: primary `Probá 30 días gratis` → `/login`, secondary `Ver planes` → `/planes`
- [ ] **Section: Tres pasos** — mounts the existing `<HowItWorksSection />` component unchanged
- [ ] **Section: Todo lo que necesitas** — mounts the existing `<FeaturesBento />` component, with the same `<h2>` + intro pattern the home uses
- [ ] **Section: Expanded SEO copy** — a `max-w-3xl` prose block (~4 paragraphs, ~350–500 words total) that walks through:
  - Qué es el F.572 / SiRADIG y para quién aplica (empleados en relación de dependencia)
  - Cómo desgrava.ar se conecta con ARCA (credencial cifrada AES-256-GCM, uso on-demand, sin credenciales en logs ni memoria)
  - Qué tipos de comprobantes detecta y clasifica (alquiler, salud, educación, personal doméstico, intereses hipotecarios), con mención al OCR + AI category classification
  - El ciclo mensual: SiRADIG actualizado → empleador retiene menos → diferencia visible en el recibo de sueldo
  - Diferenciación frente a un contador (mensual vs. anual, sin honorarios por trámite)
  - Heading is `<h2>¿Cómo se automatiza la presentación de deducciones?</h2>`
- [ ] **Section: Preguntas frecuentes** — mounts `<LandingFaq />` (the 7 conversion-focused FAQs that currently live on the home), wrapped in the same `max-w-3xl` container that `/simulador` uses for its FAQ
- [ ] **Section: CTA final** — heading `Empezá a recuperar lo que es tuyo`, intro line, primary button `Probá 30 días gratis` → `/login`, reassurance line `✓ 30 días gratis · ✓ Sin tarjeta · ✓ Cancelás cuando quieras` (mirror the bottom of `/simulador`)

### C. `/planes` content

- [ ] **`<title>`**: `Planes y precios · desgrava.ar` (≤ 70 chars)
- [ ] **`<meta description>`**: Mentions trial duration, ARS pricing, no-card sign-up, ≤ 160 chars
- [ ] **`alternates.canonical`**: `https://desgrava.ar/planes`
- [ ] **OpenGraph**: `type`, `url`, `title`, `description` set
- [ ] **Hero**: H1 `Planes y precios`, eyebrow `Suscripción mensual o anual`, intro paragraph (~2–3 sentences) covering the trial offer and that pricing is in ARS
- [ ] **Section: Tarifas** — mounts the existing `<PricingSection />` (it's already client-side for the Mensual/Anual toggle; rendering it inside a server-component page works fine)
- [ ] **Section: Expanded SEO copy** — a `max-w-3xl` prose block (~3 paragraphs, ~250–400 words) covering:
  - Qué incluye el trial de 30 días (acceso completo, sin tarjeta)
  - Diferencia mensual vs. anual (descuento del N%, calculado desde `SUBSCRIPTION_PLANS`)
  - Cómo se factura (MercadoPago, suscripción recurrente, cancelable desde `/configuracion`)
  - Qué pasa al expirar (acceso de solo lectura, datos no se borran automáticamente)
  - Heading is `<h2>Cómo funciona la suscripción</h2>`
- [ ] **Section: Preguntas frecuentes de planes** — new component `<PricingFaq />` rendered via the existing shared `<FaqAccordion>` with `jsonLdId="planes-faq-jsonld"` and the 7 questions defined in "Pricing FAQ content" below. Voseo argentino, consistent with current product behavior (no "reembolsos" promise — explicit that el período corriente sigue activo hasta el final)
- [ ] **Section: CTA final** — heading `Empezá hoy, pagá cuando estés convencido`, primary button `Probá 30 días gratis` → `/login`, reassurance line as on `/como-funciona`

### D. Navbar — anchors on home, hard links elsewhere

- [ ] `src/lib/landing/section-links.ts` `SectionLink` type changes from `{ label, href, icon }` to `{ label, anchorHref, pageHref, icon }`
  - "Cómo funciona": `anchorHref: "#desgrava"`, `pageHref: "/como-funciona"`
  - "Simulador": `anchorHref: "#simulador"`, `pageHref: "/simulador"`
  - "Planes": `anchorHref: "#planes"`, `pageHref: "/planes"`
- [ ] `src/components/layout/navbar.tsx` uses the existing `isLanding` ternary: when `isLanding` use `<a href={anchorHref}>` (hash scroll), else use `<Link href={pageHref}>` (Next.js client routing). Same change in the mobile `<Sheet>` menu.
- [ ] On `/` the navbar still scrolls smoothly to the in-page sections (no regression)
- [ ] On `/como-funciona`, `/planes`, `/simulador`, `/blog/*`, etc. the navbar links navigate to the dedicated pages — clicking "Cómo funciona" from `/blog/foo` takes you to `/como-funciona`, not `/#desgrava`

### E. Home page — keep sections, remove FAQ

- [ ] `src/app/page.tsx` keeps the `#desgrava` section but the `LandingFaq` block is removed (the inner `border-border border-t pt-16` divider that wrapped the FAQ goes with it)
- [ ] `#desgrava` now contains only HowItWorks + FeaturesBento — the section's H2 spacing is reviewed so it doesn't end with a dangling divider
- [ ] `#simulador` and `#planes` sections remain intact — the home is still the conversion path
- [ ] `LandingFaq` import is removed from `page.tsx`

### F. Footer — expose new pages

- [ ] `src/components/layout/landing-footer.tsx` adds links to `/como-funciona` and `/planes` (and `/simulador` if not already present), in whichever section of the footer holds product links — match the existing footer information architecture
- [ ] Links use `<Link>` from `next/link` (not `<a>`) since they're internal page navigation
- [ ] Footer renders correctly on every page (home + dedicated pages + dashboard + auth) — footer is rendered by surface-specific layouts so no regression elsewhere

### G. Sitemap & robots

- [ ] `src/app/sitemap.ts` adds two new entries:
  - `/como-funciona` → `priority: 0.9`, `changeFrequency: "monthly"`
  - `/planes` → `priority: 0.9`, `changeFrequency: "monthly"`
- [ ] `lastModified` set to `new Date()` (consistent with the home and `/simulador` entries)
- [ ] `/simulador` keeps its existing entry — no change there
- [ ] Verify there is no `robots.txt` or `noindex` rule blocking the new paths (root `app/robots.ts` if present)

### H. Internal linking from the home

- [ ] At the bottom of the home `#desgrava` section (where the FAQ used to live), a small "Ver más detalle" inline link points to `/como-funciona` — keeps the home tight while passing PageRank to the dedicated page
- [ ] At the bottom of the home `#planes` section, an inline link or secondary CTA points to `/planes` (e.g., "Ver detalle de planes y FAQ →")
- [ ] Both internal links use `<Link>` from `next/link`

### I. Mobile responsiveness & dark mode

- [ ] Both new pages are mobile-first and read correctly at 320px width — H1 doesn't overflow, prose blocks use `max-w-3xl mx-auto px-4`, FAQ accordion uses ≥44px touch targets (existing `<FaqAccordion>` already satisfies this)
- [ ] Section padding follows the established rhythm (`py-12 md:py-16` between sections, `border-border border-b` dividers when needed)
- [ ] All copy uses semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-muted/50`, `border-border`) — no raw `text-gray-*` / `bg-gray-*`
- [ ] Both pages render correctly in dark mode (verify on the prose blocks and on the FAQ JSON-LD scripts — JSON-LD is invisible but should still render)

### J. SEO & schema integrity

- [ ] Each dedicated page has exactly one `<h1>`, with no duplicate H1 on the home (the home has its own H1 and stays unchanged)
- [ ] `/como-funciona` emits exactly one `FAQPage` JSON-LD via `<LandingFaq />` (id `landing-faq-jsonld`); the home no longer emits this (the FAQ moved out)
- [ ] `/planes` emits exactly one `FAQPage` JSON-LD via the new `<PricingFaq />` (id `planes-faq-jsonld`)
- [ ] `/simulador` JSON-LD is untouched (id `simulador-faq-jsonld`)
- [ ] No two pages on the site share the same `jsonLdId` — the helper enforces uniqueness only by convention, but each surface uses a distinct id

### K. Tests

- [ ] No new tests required — content is presentational and inline. CLAUDE.md scopes the testing mandate to `src/lib/` and `src/hooks/`. The existing `<FaqAccordion>` already has implicit coverage via `simulador-faq` and `landing-faq` consumers.
- [ ] If during implementation a `getPricingFaqItems()` or similar helper ends up in `src/lib/`, add a unit test for it then. Otherwise inline.

## Technical Notes

### File changes

- **New** `src/app/(public)/como-funciona/page.tsx` — server component, mirrors the structure of `src/app/(public)/simulador/page.tsx`. Mounts `<HowItWorksSection />`, `<FeaturesBento />`, `<LandingFaq />`. Contains the SEO prose block inline.
- **New** `src/app/(public)/planes/page.tsx` — server component, same structure. Mounts `<PricingSection />` and the new `<PricingFaq />`. Contains the SEO prose block inline.
- **New** `src/components/landing/pricing-faq.tsx` — wraps the shared `<FaqAccordion>` with the 7-item dataset defined below. Pattern is identical to `landing-faq.tsx` and `simulador-faq.tsx`.
- **Edit** `src/lib/landing/section-links.ts` — add `anchorHref` + `pageHref` fields, keep the icon import.
- **Edit** `src/components/layout/navbar.tsx` — use `link.anchorHref` when `isLanding`, else `link.pageHref`. Same change in desktop nav and mobile `<Sheet>` nav.
- **Edit** `src/app/page.tsx` — remove the `LandingFaq` import + block from the `#desgrava` section. Add inline "Ver más" links to `/como-funciona` and `/planes` at the bottom of their respective sections.
- **Edit** `src/components/layout/landing-footer.tsx` — add links to `/como-funciona`, `/planes` (and ensure `/simulador` is there).
- **Edit** `src/app/sitemap.ts` — add two new entries.

### Why option A (keep home sections) over teasers

Mirrors the `/simulador` precedent: the home embeds the full form, the dedicated page also embeds the full form, and the dedicated page has its own canonical URL. Google has been smart about "embedded vs. dedicated" duplicate content for a decade — as long as each page has a unique canonical, unique H1, unique `<title>`, and additional unique content (the SEO prose + FAQ on the dedicated page), it doesn't trigger a duplicate-content penalty. The same logic applies here: home `#desgrava` and `/como-funciona` overlap on the HowItWorks + FeaturesBento components, but `/como-funciona` adds ~400 words of unique prose + the LandingFaq + a distinct `<title>` and canonical, so it stands on its own as a rankable page.

### Why move LandingFaq off the home

The 7 conversion FAQs are essentially "how does this work / is it safe?" content — perfect for a `/como-funciona` page where the visitor is already in research mode. On the home, having both an inline simulator and a long FAQ stretches the page; the home page conversion target is to get visitors into the simulator or to `/login`. Letting `/como-funciona` carry the FAQ also concentrates the `FAQPage` JSON-LD on a more topical URL, which Google rewards over generic homepage schema dumps.

### Navbar `isLanding` precedent

The current navbar already has the ternary in place — the only change is splitting `href` into `anchorHref` + `pageHref` so the two branches can resolve differently. This is a minimal, surgical change to `section-links.ts` and `navbar.tsx`. No ripple to other consumers because `sectionLinks` is only imported by the navbar today (verify with grep before editing).

### Mobile-first design

- Headlines use `text-3xl md:text-5xl` (matches `/simulador` H1)
- Prose blocks use `max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16` (matches `/simulador`'s SEO copy section)
- FAQ wrapper inherits its mobile rules from the existing `<FaqAccordion>` — already validated at 320px in the `landing-preguntas-frecuentes.md` spec
- All buttons reuse `size="lg"` from shadcn (44px+ touch target)

### Why MercadoPago Suscripciones details belong on /planes, not the home

Pricing edge cases (anual vs. mensual, métodos de pago, qué pasa al cancelar) clutter the home pricing card. Moving them to a dedicated page lets the home stay decision-focused (3 cards + toggle) and gives the visitor a place to land when they're already considering checkout. [Lenny: Jason Cohen — visitors who reach the pricing page have already cleared the homepage filter, so it's worth giving them dense answers there]

### SEO copywriting voice

- Voseo argentino (`Cargá`, `Probá`, `Cancelás`, `Empezá`)
- Concrete numbers where possible (`30 días`, `35% alícuota máxima`, `AES-256-GCM`)
- No promotional fluff — every paragraph either explains a mechanism or addresses an objection
- Reuse the language patterns already established in `/simulador`'s SEO copy and `landing-preguntas-frecuentes.md`

---

## Pricing FAQ content (to copy literal into `pricing-faq.tsx`)

1. **¿Cuánto dura la prueba gratuita?**
   30 días, con acceso completo a todo lo que incluye el plan Personal — carga de comprobantes, importación desde ARCA, presentación a SiRADIG, simulador. No te pedimos tarjeta de crédito para empezar.

2. **¿Necesito tarjeta de crédito para registrarme?**
   No. La prueba se activa solo con tu cuenta de Google o tu email + contraseña. Si al final de los 30 días querés continuar, te pedimos un medio de pago a través de MercadoPago.

3. **¿Puedo cancelar cuando quiera?**
   Sí. Cancelás desde `/configuracion` con un click. La cancelación detiene la próxima renovación; el período corriente sigue activo hasta el final, así no perdés lo que ya pagaste.

4. **¿Hay descuento por pago anual?**
   Sí. El plan anual aplica un descuento sobre el precio mensual (el porcentaje exacto se ve en la página de planes con el toggle Mensual/Anual). Pagás un solo cargo por todo el año a través de MercadoPago.

5. **¿Qué métodos de pago aceptan?**
   Cobramos a través de MercadoPago, así que aceptamos tarjetas de crédito, débito y dinero en cuenta de MercadoPago — los mismos medios que usás todos los días en Argentina.

6. **¿Qué pasa con mis datos si cancelo o si vence la suscripción?**
   La cuenta entra en modo de solo lectura: podés seguir consultando tus comprobantes y deducciones, pero no podés cargar nuevas ni presentar a SiRADIG. Tus datos no se borran automáticamente — si querés borrarlos, lo hacés vos desde el panel.

7. **¿Puedo cambiar entre plan mensual y anual?**
   Sí. Al cambiar de mensual a anual, el cambio se aplica en la próxima renovación con el precio anual con descuento. Para volver de anual a mensual, esperás al final del ciclo anual ya pagado.

## Out of Scope

- A/B testing copy variants — premature at zero paying users, follow `0-to-1000-users-growth-plan.md`
- New pricing tiers, gating logic, or changes to `SUBSCRIPTION_PLANS` — pricing data is unchanged, only presentation
- A standalone `/contadores` plan page — the Contadores tier is still inside the existing `<PricingSection />`
- A multi-step "Tour del producto" with screenshots beyond what `<HowItWorksSection />` already shows — the existing 3 step images cover it
- A `/comparar-con-contador` or `/vs-contador` comparison page — separate spec if/when keyword research justifies it
- A pricing comparison table with checkmark grid — current 2-card layout (Personal + Contadores) is sufficient at this scale
- Schema.org `Product` / `Offer` JSON-LD on `/planes` — Google's `Offer` schema for SaaS subscriptions is fragile and easy to get flagged; stick with `FAQPage` for now
- Internationalization — Spanish-only
- Adding `/como-funciona` or `/planes` to the post-onboarding tour — the tour stays focused on dashboard surfaces
- Changing the `/simulador` page itself — out of scope here
- Removing the home `#desgrava` or `#planes` anchored sections — option A keeps them
- Translating LandingFaq into a separate `como-funciona-faq.tsx` — same component is reused on `/como-funciona`; if its copy ever needs to differ between surfaces, that's a future spec
