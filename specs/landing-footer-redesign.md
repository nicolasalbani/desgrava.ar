---
title: Landing Footer Redesign with Legal Pages
status: implemented
priority: medium
---

## Summary

The landing footer is currently a single centered disclaimer line ("desgrava.ar · sin afiliación a ARCA/AFIP"). For a credentials-handling B2C tax product targeting Argentine taxpayers, that line carries all the structural weight of the page — there are no legal pages to point to, no contact paths, no brand presence, and no second CTA after the user scrolls past pricing. This feature rewrites the public-route footer into a four-column layout (Brand + Producto + Contacto + Legal), tops it with a "Probá 30 días gratis" CTA banner, and creates the three legal pages (`/terminos`, `/privacidad`, `/cookies`) it links to. The minimal dashboard footer stays unchanged.

## Acceptance Criteria

### Scope split: landing-only footer

- [ ] A new `LandingFooter` component lives at `src/components/layout/landing-footer.tsx`
- [ ] The existing `Footer` (`src/components/layout/footer.tsx`) stays as-is and continues to render on dashboard and auth routes
- [ ] `LandingFooter` is used only on public marketing routes: `/` (`src/app/page.tsx`) and the three new legal pages
- [ ] Container width matches the rest of the landing page: `max-w-5xl mx-auto px-4 md:px-6`

### CTA banner (top band of the footer)

- [ ] Top band shows a centered block: heading "¿Listo para recuperar tu plata?", a primary `<Button size="lg" asChild>` labeled "Probá 30 días gratis" with `ArrowRight` icon linking to `/login`, and below it the reassurance line "Sin tarjeta de crédito · Cancelás cuando quieras" in `text-muted-foreground text-xs`
- [ ] The CTA band uses `bg-muted/30` and a top border (`border-t border-border`) to separate from the page above
- [ ] On mobile (<sm), heading wraps cleanly and the button is full-width; at `sm+` the button is intrinsic width
- [ ] CTA reuses the same Button component and href pattern as the hero so styling stays in sync

### Four-column main grid

- [ ] Below the CTA band, four columns: **Brand**, **Producto**, **Contacto**, **Legal**
- [ ] Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- [ ] Each column heading in `text-foreground text-sm font-semibold mb-3`; links in `text-muted-foreground hover:text-foreground text-sm` with `gap-y-2`

### Brand column

- [ ] desgrava.ar logo (`/logo.png`, 40×40) + wordmark, same treatment as the navbar brand
- [ ] One-sentence tagline below: "Recuperá la plata que Ganancias te saca."
- [ ] Three icon-only social links below the tagline: X/Twitter, WhatsApp, email
- [ ] Icons from `lucide-react` (`Twitter`, `MessageCircle`, `Mail`) sized `h-4 w-4`, with `aria-label` ("X", "WhatsApp", "Email")
- [ ] External links open in a new tab (`target="_blank" rel="noopener noreferrer"`)

### Producto column

- [ ] Heading: "Producto"
- [ ] Links in order: "Cómo funciona" (`/#desgrava`), "Simulador" (`/#simulador`), "Planes" (`/#planes`), "Iniciar sesión" (`/login`)
- [ ] Labels and hrefs come from a shared constant so they stay in lockstep with the navbar (see Technical Notes)

### Contacto column

- [ ] Heading: "Contacto"
- [ ] Links in order:
  - "Email" → `mailto:<SUPPORT_EMAIL>` (label shows the address)
  - "WhatsApp" → `https://wa.me/<SUPPORT_WHATSAPP>`
  - "X: @desgrava_ar" → `https://x.com/desgrava_ar`
- [ ] If `SUPPORT_EMAIL` or `SUPPORT_WHATSAPP` is missing at runtime, the relevant entry is omitted (no broken `mailto:` or `wa.me/undefined` links)

### Legal column

- [ ] Heading: "Legal"
- [ ] Links in order: "Términos y condiciones" (`/terminos`), "Política de privacidad" (`/privacidad`), "Política de cookies" (`/cookies`)
- [ ] Below the links, a non-link disclaimer line "Sin afiliación a ARCA/AFIP" in `text-muted-foreground italic text-xs`

### Bottom legal bar

- [ ] Below the four-column grid, a thin bar separated by `border-t border-border`
- [ ] Left: "© <year> desgrava.ar" — year from `new Date().getFullYear()`, server-rendered
- [ ] Right: "Hecho en 🇦🇷 Argentina" (single Unicode flag emoji)
- [ ] Mobile (<sm): stacks vertically with `gap-2`; `sm+`: single line with `justify-between`
- [ ] Both lines use `text-muted-foreground text-xs`

### Legal pages

- [ ] Three new public routes: `/terminos`, `/privacidad`, `/cookies` — placed under the `(public)` route group
- [ ] Each is a server component rendering a long-form article with `<Navbar />` + `<LandingFooter />`
- [ ] Each page surfaces a `LAST_UPDATED` constant at the top of the file (e.g. `"2026-05-01"`) and shows it in the page header
- [ ] Each page has a `metadata` export with `title` and `description` for SEO
- [ ] Initial Spanish drafts written in voseo, covering at minimum the sections listed in Technical Notes
- [ ] Pages render cleanly at 320px and use the existing typography scale (no `prose` plugin if not already installed — use plain Tailwind utilities)

### Mobile responsiveness

- [ ] Footer reads cleanly at 320px width — no horizontal scroll, no truncated copy
- [ ] Columns stack 1-up on mobile, 2-up at `sm`, 4-up at `lg`
- [ ] CTA button is full-width on mobile
- [ ] All touch targets ≥ 44px (link rows have ample vertical padding)

### Dark mode

- [ ] All text uses semantic tokens (`text-foreground`, `text-muted-foreground`)
- [ ] Backgrounds use `bg-background` / `bg-muted/30`
- [ ] No raw `text-gray-*`, `bg-gray-*`, or `text-blue-*` classes

## Technical Notes

- **Two-component split**: the existing minimal `Footer` (single-line ARCA disclaimer) keeps rendering on dashboard and auth routes — those layouts have no marketing context. The new `LandingFooter` is used only by `(public)/` routes. This avoids touching the dashboard layout for no reason.
- **Server component**: `LandingFooter` has no interactivity. No `"use client"`. Reading `process.env.SUPPORT_EMAIL` / `SUPPORT_WHATSAPP` happens at request time on the server.
- **Section-link reuse**: `src/components/layout/navbar.tsx` defines `sectionLinks` as a local const. Lift it to `src/lib/landing/section-links.ts` so navbar and footer share one source of truth — avoids drift if a section is renamed.
- **Twitter/X handle**: hard-code `https://x.com/desgrava_ar`. Verify the account exists before merge.
- **Env-var safety**: `SUPPORT_EMAIL` and `SUPPORT_WHATSAPP` are documented in `CLAUDE.md` as optional at runtime. Conditionally render their links — don't fall back to placeholder strings.
- **Legal content scope** (initial drafts; flag in the PR that they need lawyer review before launch):
  - **Términos y condiciones**: descripción del servicio, registro/cuenta, planes y pagos (MercadoPago), uso aceptable, propiedad intelectual, limitación de responsabilidad, ley aplicable (Argentina), terminación de cuenta, contacto
  - **Política de privacidad**: datos recolectados (incluye credenciales ARCA cifradas con AES-256-GCM), finalidad, subprocesadores (MercadoPago, Resend, OpenAI, Fly.io, Umami Cloud), derechos del titular bajo Ley 25.326 de Protección de los Datos Personales, retención, contacto del responsable
  - **Política de cookies**: cookies estrictamente necesarias (sesión NextAuth), analítica (Umami Cloud — sin cookies de tracking de terceros), cómo deshabilitar
- **No `prose` plugin**: avoid pulling in `@tailwindcss/typography` for three legal pages. Style with plain `text-foreground`, `text-muted-foreground`, `space-y-4`, and heading utilities.
- **Mobile-first**: design for 320px first, enhance at `sm:` and `lg:`. Use existing Tailwind 4 breakpoints — no custom screens.
- **Visual style**: match the Jony-Ive-inspired palette already used on the landing — generous padding (`py-12 md:py-16`), subtle `border-border` separators, no heavy shadows.
- **No new icons or assets**: reuse `lucide-react` icons. The logo file (`/logo.png`) is already shipped.
- **Single PR**: ship the footer + three legal pages together so footer links never 404.

## Out of Scope

- Newsletter signup form in the footer
- Customer logo wall, partner logos, or "as seen in" press strip
- Multilingual footer — desgrava.ar is Spanish-only
- Sitemap.xml or robots.txt updates (separate SEO spec)
- Linking to blog, press kit, careers, or "About us" pages — none exist
- Adding the new footer to dashboard / auth / panel routes — the existing minimal `Footer` stays there
- Cookie consent banner — Umami Cloud is privacy-friendly and cookieless; revisit only if we add Meta/Google ads
- Lawyer-reviewed final legal text — initial drafts are starting points, not legal counsel
- Instagram, LinkedIn, or other social links beyond email / WhatsApp / X (per the user's answer)
- Updating `SUPPORT_EMAIL` or `SUPPORT_WHATSAPP` env-var values themselves
- New analytics events for footer link clicks
- Footer A/B testing infrastructure — premature at zero paying users
