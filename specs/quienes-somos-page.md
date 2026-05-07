---
title: Quiénes Somos Page
status: implemented
priority: low
---

## Summary

The site has marketing pages (home, /como-funciona, /planes, /simulador, /blog) and policy pages (/terminos, /privacidad, /cookies) — but no surface that introduces the people behind desgrava.ar. For a product that asks visitors to hand over their ARCA credentials and a payment method, "who's behind this?" is a real conversion objection — and one not currently answered anywhere on the site. This feature adds a `/quienes-somos` page with a short mission paragraph (why we built desgrava.ar) followed by a two-person team grid covering Nicolás Albani (Fundador) and Nicolás Barbolla (Asesor contable, estudiobya.com.ar). Photos are placeholder silhouettes that can be swapped in by overwriting the image files — no code changes required. The page is exposed only via the footer (no navbar entry), matching the standard "About" pattern.

## Acceptance Criteria

### A. Route & layout

- [ ] New file `src/app/(public)/quienes-somos/page.tsx` — server component, mounts under the existing `(public)/layout.tsx` shell (Navbar + Footer)
- [ ] No new API routes, no DB changes
- [ ] **Metadata**:
  - `<title>`: `Quiénes somos · desgrava.ar` (≤ 70 chars)
  - `<meta description>`: One sentence covering who founded desgrava.ar and that the tax logic is reviewed by a contador colegiado, ≤ 160 chars
  - `alternates.canonical`: `https://desgrava.ar/quienes-somos`
  - OpenGraph: `type: "website"`, `url`, `title`, `description`

### B. Hero (mission paragraph)

- [ ] **H1**: `Quiénes somos`, eyebrow `El equipo detrás de desgrava.ar`, both centered (or left on `md+`) — match the typography used on `/como-funciona` (`text-3xl md:text-5xl` for H1, `text-primary text-xs font-semibold uppercase tracking-wider` for the eyebrow)
- [ ] **Mission paragraph** (~3 sentences, voseo, max-width-2xl, leading-relaxed): explains why desgrava.ar exists — Argentine employees in relación de dependencia pierden plata todos los meses por no presentar SiRADIG; el F.572 es un trámite repetitivo que un contador típicamente carga una vez al año; nosotros lo convertimos en software para que se haga todos los meses sin esfuerzo. Final sentence framing: "Por eso lo construimos" or similar.
- [ ] The exact mission copy is editorial — final text gets refined before merge based on user input. The spec only requires the structure (3 sentences, voseo, addresses motivation explicitly).

### C. Team grid

- [ ] Two-card layout: 1 col on mobile (<sm), 2 cols on `sm+`. Cards inside `mx-auto max-w-4xl` so they don't stretch on wide screens.
- [ ] Each card uses the standard pattern: `border-border bg-card rounded-2xl border p-6 sm:p-8`
- [ ] Each card contains, in order:
  1. **Photo** — circular `<Image>` (200x200 displayed, source 400x400+ for retina), `rounded-full object-cover aspect-square w-32 sm:w-40 mx-auto`, with `alt` matching the person's name
  2. **Name** — `<h2>` (`text-foreground text-xl font-semibold mt-4 text-center`)
  3. **Role badge / subtitle** — `<p>` (`text-primary text-sm font-medium text-center`)
  4. **Bio paragraph** — `<p>` (`text-muted-foreground text-sm leading-relaxed mt-4`) covering background, expertise, and motivation (3–4 sentences per person, in voseo argentino — final copy editorial)
  5. **External link** — single text link with arrow, opens in new tab, `target="_blank" rel="noopener noreferrer"`, styled `text-primary hover:underline inline-flex items-center gap-1 mt-4 text-sm`

### D. Person 1 — Nicolás Albani (Fundador)

- [ ] Name: **Nicolás Albani**
- [ ] Role: **Fundador**
- [ ] Bio: 3–4 sentences in voseo. Should cover: software engineer background, why he started desgrava.ar (his own frustration with F.572 / SiRADIG), what he focuses on (product, automation, ARCA integration). Final text editorial — placeholder included in the page file with a `// TODO: refine bio` comment.
- [ ] Link: `https://www.linkedin.com/in/nicolasalbani/`, label `LinkedIn` with the lucide `Linkedin` icon (`h-4 w-4`)
- [ ] Photo path: `/images/team/nicolas-albani.jpg`

### E. Person 2 — Nicolás Barbolla (Asesor contable)

- [ ] Name: **Nicolás Barbolla**
- [ ] Role: **Asesor contable**
- [ ] Bio: 3–4 sentences in voseo. Should cover: contador colegiado running estudiobya.com.ar, his role validating desgrava.ar's tax logic and SiRADIG flows, why this matters (compliance, accuracy of the Ganancias calculations and the 4ta-categoría rules). Final text editorial — placeholder included in the page file with a `// TODO: refine bio` comment.
- [ ] Link: `https://estudiobya.com.ar/`, label `Estudio Barbolla y Asociados` with the lucide `ExternalLink` icon (`h-4 w-4`)
- [ ] Photo path: `/images/team/nicolas-barbolla.jpg`

### F. Photos (placeholder)

- [ ] New directory `public/images/team/`
- [ ] One canonical placeholder asset committed: `public/images/team/placeholder-avatar.png` — a 400×400 PNG, gray (`#e5e7eb` light / `#374151` dark — but as a single grayscale PNG that reads OK on both themes), with a centered silhouette icon (the lucide `User` icon scaled to ~60% of the canvas, drawn in `#9ca3af`). The file is committed so the page renders out of the box.
- [ ] Both per-person files are committed as **byte-identical copies** of `placeholder-avatar.png`: `public/images/team/nicolas-albani.jpg` and `public/images/team/nicolas-barbolla.jpg` (note `.jpg` extension is fine even though the bytes are PNG initially — Next.js/browsers content-type-sniff; the user will overwrite with real JPGs later)
- [ ] **Replacement workflow** documented in a comment at the top of the page file: "To set a real photo: drop a square JPG (≥ 400×400) at `public/images/team/<slug>.jpg`. No code changes required."
- [ ] **Note in spec body**: LinkedIn blocks programmatic image scraping; the founder photo cannot be auto-fetched. The placeholder is shipped instead.

### G. Footer link

- [ ] `src/components/layout/landing-footer.tsx` — add a "Quiénes somos" link to the existing "Producto" column, placed between the `sectionLinks` map and the existing "Blog" link. Same `<Link>` styling as the other items (`min-h-[44px]` touch target).
- [ ] **No navbar entry** — `src/lib/landing/section-links.ts` is unchanged. The page is intentionally a footer-only surface (matches the standard "About Us" pattern; we don't want to dilute the navbar's three conversion-focused entries).

### H. Sitemap

- [ ] `src/app/sitemap.ts` — add `/quienes-somos` entry: `priority: 0.4`, `changeFrequency: "yearly"` (it's a low-velocity page; the team isn't going to change often)

### I. CTA at the bottom

- [ ] Below the team grid, a single soft CTA section (matching the bottom of `/como-funciona`): `<h2>¿Querés probar lo que construimos?</h2>`, intro line, primary button `Probá 30 días gratis` → `/login`, reassurance line `✓ 30 días gratis · ✓ Sin tarjeta · ✓ Cancelás cuando quieras`

### J. Mobile responsiveness & dark mode

- [ ] Page reads correctly at 320px width: H1 doesn't overflow, photos shrink to `w-32`, cards stack vertically with full-width body, links wrap if needed (`break-words` on the bio paragraph if it contains long URLs — it doesn't, but defensive)
- [ ] Photo `<Image>` uses `sizes="(min-width: 640px) 160px, 128px"` and explicit `width={400} height={400}` to avoid layout shift
- [ ] Touch targets ≥ 44px on the external link (already satisfied by `inline-flex items-center` + padding)
- [ ] All copy uses semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `text-primary`) — no raw `text-gray-*`
- [ ] Dark mode: card pattern + image work without a `dark:` variant because the placeholder asset is grayscale and the cards already use semantic tokens

### K. Tests

- [ ] No new tests required — content is presentational, no `src/lib/` or `src/hooks/` modules added. CLAUDE.md scopes the testing mandate to those two directories.

## Technical Notes

### File changes

- **New** `src/app/(public)/quienes-somos/page.tsx` — server component, all content inline (no extracted helpers since it's a single static page with two cards)
- **New** `public/images/team/placeholder-avatar.png` (single canonical placeholder)
- **New** `public/images/team/nicolas-albani.jpg` (initial copy of placeholder)
- **New** `public/images/team/nicolas-barbolla.jpg` (initial copy of placeholder)
- **Edit** `src/components/layout/landing-footer.tsx` — add the "Quiénes somos" `<Link>` in the "Producto" column
- **Edit** `src/app/sitemap.ts` — add the `/quienes-somos` entry

### Why footer-only

The navbar already carries Cómo funciona / Simulador / Planes — the three pages most strongly tied to conversion. Adding a fourth would dilute the conversion path. About-us pages convert poorly directly but matter for trust on the way to checkout — the footer is the canonical placement. Visitors who care will scroll-and-look; those who don't aren't penalized.

### Why a single committed placeholder asset

LinkedIn doesn't allow direct hot-linking (CSP blocks it on most surfaces) or programmatic scraping (rate limits + CAPTCHA). The lowest-friction path: ship a placeholder, let the user drop in real JPGs when they have them. The placeholder is a real PNG (not a missing file or `<svg>`) so Next.js's `<Image>` doesn't 404 on first deploy.

### Photo asset spec

- Format: PNG (initial placeholder) → JPG (when replaced with real photos)
- Dimensions: 400×400 minimum, square. Larger is fine — `<Image>` will downsize.
- The placeholder PNG should be a centered silhouette on a neutral gray background so it reads OK in both themes without per-theme variants. (We can also use `bg-muted` on the wrapper as belt-and-suspenders.)

### Mobile-first

- 1 col below `sm`, 2 cols at `sm+`. Photos shrink on mobile (`w-32` vs `w-40`).
- All buttons and links satisfy 44px minimum touch height via existing `min-h-[44px]` or `inline-flex items-center` + `py-2.5`.
- No tables, no horizontal scroll, no fixed widths.

### Bio copy

- Final bio text per person is editorial — the page file ships with placeholder bios marked `// TODO: refine bio` so the page renders meaningfully on first deploy but is clearly flagged for revision. The spec captures the structural requirements (voseo, 3–4 sentences, covers background + expertise + motivation) but not the exact words.

### Voseo and tone

- All copy in voseo argentino (`construimos`, `creemos`, `validamos`, `presentamos`)
- No corporate puffery ("líder en innovación", "la solución definitiva") — match the direct, mechanism-focused tone of the rest of the site

## Out of Scope

- A blog post or newsletter signup on the about page — keep the page focused
- A "Press" or "Contact" subsection — contact info already lives in the footer (`SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`)
- Photo CMS / admin panel for editing team — overkill for a 2-person team; file-system swap is fine
- Animations beyond what's already in the design system (no scroll-triggered fade-ins specific to this page)
- Multilingual support — Spanish-only (matches the rest of the site)
- A `/contacto` page — separate spec if/when needed
- Adding a third team member or "growing team" placeholder slot — out of scope until there's a third person
- Schema.org `Organization` / `Person` JSON-LD — Google's `Person` schema is fragile for small businesses; skip for now (the rich-snippet payoff is minimal at this traffic level)
- Linking to Nicolás Barbolla's LinkedIn separately — the link to estudiobya.com.ar is the canonical professional surface for him; LinkedIn would be redundant
- Replacing the placeholder PNG with a real LinkedIn-scraped photo — explicitly not attempting this (LinkedIn blocks; the placeholder + manual replace flow is the chosen path)
- Custom social-share OG image specific to `/quienes-somos` — inherits the root `metadata` OG image
- Adding the new page to the post-onboarding tour — the tour is dashboard-focused; About Us doesn't belong there
- Footer column restructuring (e.g., adding a new "Empresa" column) — minimal-disruption insertion into "Producto" is enough
