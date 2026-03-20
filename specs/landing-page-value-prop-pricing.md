---
title: Landing Page Redesign — Value Prop & Pricing
status: implemented
priority: high
---

## Summary

The current landing page has a hero, 4 feature cards, and a reviews carousel — but it doesn't communicate what desgrava.ar actually does step-by-step, doesn't show pricing, and doesn't embed the simulator as a conversion hook. This redesign restructures the page into 5 clear sections (Hero, Features, How It Works, Simulador embed, Pricing) to better communicate the value proposition and convert visitors into users. The reviews carousel is removed to keep the page focused.

## Acceptance Criteria

### Hero Section

- [ ] Headline communicates the core problem (losing money to Ganancias) and the solution
- [ ] Subheading explains what desgrava.ar does in one sentence
- [ ] Two CTAs: primary "Calcula tu ahorro" → `/simulador`, secondary "Empeza gratis" → `/login`
- [ ] Hero illustration: an AI-generated image that visually represents the concept (e.g., a person relaxing while tax paperwork handles itself, or money flowing back to a person). Displayed to the right of the headline on desktop, below on mobile.

### Features Section

- [ ] 4 feature cards in a grid: Simulador, Facturas (OCR + manual + ARCA import), Automatizacion SiRADIG, Seguridad
- [ ] Each card has an icon, title, and 1-2 sentence description
- [ ] Responsive: 1 col mobile, 2 col tablet, 4 col desktop

### How It Works Section

- [ ] 3 numbered steps showing the user journey: (1) Simula tu ahorro, (2) Carga tus facturas, (3) Enviamos a SiRADIG
- [ ] Each step has a number/icon, title, short description, and an AI-generated illustration representing that step
- [ ] Horizontal layout on desktop, vertical stack on mobile

### Simulador Embed Section

- [ ] Embeds the existing simulador calculator inline on the landing page as a conversion hook
- [ ] Heading like "Calcula cuanto podes recuperar" with a brief intro
- [ ] The embedded simulador uses the same component/logic from `/simulador` (reuse, don't duplicate)
- [ ] CTA below the simulador: "Registrate para desgravar" → `/login`

### Pricing Section

- [ ] 3 pricing tiers displayed as cards side-by-side (1 col mobile, 3 col desktop)
- [ ] **Gratis** tier: $0/mes, 30 dias de prueba, includes: simulador, carga manual de facturas (hasta 20), clasificacion AI de categoria
- [ ] **Personal** tier: suggested ~$4.999/mes, includes: todo lo de Gratis + facturas ilimitadas, importacion desde ARCA, envio automatico a SiRADIG, soporte por email
- [ ] **Contadores** tier: suggested ~$14.999/mes, includes: todo lo de Personal + multiples CUITs/clientes, gestion de empleados en relacion de dependencia, soporte prioritario
- [ ] Each card shows: tier name, price, short tagline, feature list with checkmarks, CTA button
- [ ] The Personal tier is visually highlighted as "recommended" (e.g., primary border, badge)
- [ ] CTA buttons: Gratis → "Empeza gratis" (`/login`), Personal → "Proba 30 dias gratis" (`/login`), Contadores → "Contactanos" (mailto or `/login`)

### AI-Generated Images

- [ ] Generate 4 illustrations using an AI image tool (e.g., GPT-4o image generation or similar): 1 hero image + 3 how-it-works step images
- [ ] Style: clean, modern, flat/isometric illustration style that matches the minimalist design system — light colors, soft shadows, no photorealism
- [ ] Images are saved to `public/images/landing/` as optimized PNGs or WebPs
- [ ] Images are served via Next.js `<Image>` component with proper `alt` text, `width`, `height`, and lazy loading
- [ ] Both light and dark variants are provided (or images use transparent backgrounds that work on both)

### General

- [ ] Reviews carousel is removed from the page
- [ ] All sections follow the existing design system: `bg-background`, `bg-muted/50`, `border-border`, semantic color tokens with dark mode support
- [ ] Alternating section backgrounds (white / muted) for visual rhythm
- [ ] All sections use `max-w-5xl` container with consistent padding
- [ ] Page is fully responsive and supports dark mode

## Technical Notes

### File changes

- **`src/app/page.tsx`** — Restructure into 5 sections (Hero, Features, How It Works, Simulador, Pricing). Remove ReviewsCarousel import.
- **`src/components/landing/pricing-section.tsx`** — New component for the 3-tier pricing cards. Pure presentational, no API calls. Pricing data defined as a const array in the component.
- **`src/components/landing/how-it-works-section.tsx`** — New component for the 3-step process.
- **`src/components/landing/simulador-embed.tsx`** — New component that wraps the existing simulador form for inline embedding on the landing page. Reuse the calculator logic from `src/lib/simulador/`.
- **`src/components/landing/reviews-carousel.tsx`** — Keep file but remove usage from `page.tsx`. Can be deleted later if not needed elsewhere.

### Simulador embed

The existing `/simulador` page likely has a form component that can be extracted or reused. Inspect `src/app/(public)/simulador/page.tsx` and `src/components/simulador/` to determine if the form is already a standalone component or needs to be extracted. The embed should work without authentication.

### Pricing data

Prices are hardcoded in the component (no DB or API). Use Argentine peso formatting (`$X.XXX`). The exact prices ($4.999 and $14.999) are suggestions — they should be easy to change (defined as a const object at the top of the pricing component).

### AI image generation

Generate 4 images during implementation using an AI image generation tool. Suggested prompts should request clean, flat illustration style with transparent or neutral backgrounds. Save outputs to `public/images/landing/`:

- `hero-illustration.webp` — Main hero visual (person saving money / tax automation concept)
- `step-1-simulate.webp` — Calculator / simulation concept
- `step-2-invoices.webp` — Uploading or scanning invoices
- `step-3-automation.webp` — Robot or automation sending data

Use Next.js `<Image>` with explicit dimensions to avoid layout shift. Keep file sizes under 200KB each (optimize with WebP).

### Design patterns

- Follow existing card pattern: `bg-muted/50 border rounded-lg p-6`
- Section alternation: Hero (bg-background) → Features (bg-muted/50 + border-t) → How It Works (bg-background + border-t) → Simulador (bg-muted/50 + border-t) → Pricing (bg-background + border-t)
- Icons from `lucide-react`
- All colors via semantic tokens (bg-background, text-foreground, bg-muted, text-muted-foreground, border-border, bg-primary, text-primary-foreground) — no raw colors without dark: counterparts

## Out of Scope

- Stripe/MercadoPago payment integration — pricing is informational only for now
- User plan/subscription model in the database
- Gating features behind plan tiers (no enforcement)
- Team/FAQ/Trust logos/footer redesign
- Blog or resources section
- Animated transitions or scroll effects
