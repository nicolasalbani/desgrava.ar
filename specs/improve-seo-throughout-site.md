---
title: SEO hygiene pass — robots, schema, full sitemap, missing meta
status: implemented
priority: medium
---

## Summary

The site already has the basics in place: per-page `Metadata` on public routes, a sitemap covering all marketing pages and blog posts, a default OG image, `FAQPage` JSON-LD on `/simulador` / `/como-funciona` / `/planes`, and `Article` JSON-LD on blog posts. But there are gaps that limit indexability and rich-result eligibility: no `robots.ts`, no `Organization` / `WebSite` schema (hurts brand searches and the Google knowledge panel), no `HowTo` schema on `/como-funciona` (the page is literally a how-to and is leaving rich-result money on the table), no `BreadcrumbList` on blog posts, missing canonical/OG/Twitter tags on `/`, `/terminos`, `/privacidad`, `/cookies`, auth pages (`/forgot-password`, `/reset-password`, `/verify-email`) are crawlable when they shouldn't be, and `sitemap.ts` stamps `lastModified: new Date()` on every entry on every request — which Google ignores once it figures out the lie. This spec is a pure hygiene pass: tighten everything that's already there, add the missing schemas, add a `robots.ts` that points at the sitemap and disallows the dashboard + sensitive auth flows, and don't introduce new content pages or programmatic SEO. Each schema added must pass Google's Rich Results Test before merging.

## Acceptance Criteria

### A. Robots & crawl control

- [ ] New file `src/app/robots.ts` exporting Next's `MetadataRoute.Robots` with:
  - `rules`: a single rule for `userAgent: "*"`, `allow: "/"`, `disallow: ["/api/", "/panel", "/comprobantes", "/recibos", "/automatizacion", "/credenciales", "/configuracion", "/perfil", "/trabajadores", "/presentaciones", "/empleadores", "/datos-personales", "/forgot-password", "/reset-password", "/verify-email"]`
  - `sitemap: "https://desgrava.ar/sitemap.xml"`
  - `host: "desgrava.ar"`
- [ ] `/login` stays crawlable (allowed) — explicit decision per the clarifying questions, brand entry point [SEO audit]
- [ ] No `robots.txt` static file in `public/` — Next generates from `robots.ts`
- [ ] Auth pages that should not be indexed emit `metadata: { robots: { index: false, follow: false } }` on the page itself (belt-and-suspenders alongside the disallow):
  - `src/app/(auth)/forgot-password/page.tsx`
  - `src/app/(auth)/reset-password/page.tsx`
  - `src/app/(auth)/verify-email/page.tsx`
- [ ] `/login` does NOT receive `noindex`

### B. Sitemap polish

- [ ] `src/app/sitemap.ts` no longer uses `new Date()` indiscriminately. Replace with stable per-route timestamps:
  - Use the constant `SITE_LAST_BUILT = new Date()` once at module load (still re-evaluates per server start, but does not change per-request — Google treats stable values as more credible)
  - Blog post entries: keep `frontmatter.date` as `lastModified` (already correct)
  - `/blog` index `lastModified`: pick the max `frontmatter.date` across all posts (most recent post date), not `new Date()`
  - Static legal pages (`/terminos`, `/privacidad`, `/cookies`) get a hardcoded `LAST_LEGAL_UPDATE = "2026-05-01"` parsed to a `Date`, matching the `LAST_UPDATED` constants already in those files
- [ ] Sitemap entries unchanged otherwise — no new URLs added in this spec
- [ ] After deploy: re-submit `sitemap.xml` URL via Google Search Console (operational checklist item, not code)

### C. Site-wide schema (root layout)

- [ ] `src/app/layout.tsx` injects two new JSON-LD blocks (next to the existing `<Script>` for Umami) inside `<body>`:
  1. `Organization` schema — `@type: "Organization"`, `name: "desgrava.ar"`, `url: "https://desgrava.ar"`, `logo: "https://desgrava.ar/logo.png"`, `sameAs: ["https://www.linkedin.com/in/nicolasalbani/"]` (use the founder LinkedIn already linked from `/quienes-somos`; add Twitter/Instagram only if those handles exist)
  2. `WebSite` schema — `@type: "WebSite"`, `name: "desgrava.ar"`, `url: "https://desgrava.ar"`, `inLanguage: "es-AR"`. **No** `SearchAction` / sitelinks searchbox (the site has no internal search; emitting a fake one risks a Google manual action)
- [ ] Both blocks use the same `<Script id="..." type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />` pattern as the existing FAQ/Article schemas (no `strategy="afterInteractive"` for JSON-LD — needs to be in the initial HTML so crawlers see it)
- [ ] Site-wide schema validates against Google's Rich Results Test (`Organization` and `WebSite`) before merging

### D. Per-page schema additions

- [ ] `/como-funciona` mounts a new `HowTo` JSON-LD block alongside the existing `<LandingFaq>` `FAQPage` schema:
  - `@type: "HowTo"`, `name: "Cómo automatizar tus deducciones de Ganancias con desgrava.ar"`, `description` matches the page meta description, 3 `step` items mirroring the existing `<HowItWorksSection>` content (conectar ARCA → cargar/importar comprobantes → presentar a SiRADIG), each with `@type: "HowToStep"`, `name`, `text`, and `url: "https://desgrava.ar/como-funciona#step-N"` (anchors don't have to exist physically — Google accepts them)
  - `jsonLdId="como-funciona-howto-jsonld"` for uniqueness
- [ ] `/blog/[slug]` adds a `BreadcrumbList` JSON-LD block alongside the existing `Article` block:
  - 3 items: `Inicio` → `/`, `Blog` → `/blog`, post title → `/blog/<slug>`
  - `jsonLdId="blog-breadcrumb-jsonld-${slug}"` (interpolated, distinct per post)
- [ ] All new JSON-LD blocks pass Google's Rich Results Test before merging — acceptance criterion enforced manually by the implementer paste-testing the rendered HTML

### E. Backfill missing meta on existing pages

- [ ] `/` (home) — `src/app/page.tsx` exports an explicit `Metadata` (today it relies on the root layout default):
  - `title`: keep root layout default OR make it explicit (`"desgrava.ar — Recuperá la plata que Ganancias te saca"`) — implementer's call as long as it's ≤ 70 chars
  - `description`: same as root or punchier — match the H1 promise, mention F.572 / SiRADIG, ≤ 160 chars
  - `alternates.canonical: "https://desgrava.ar/"` (currently missing — Google has been known to dedupe `/` with `/?utm_*` URLs unhelpfully without it)
  - `openGraph: { type, url, title, description }` — explicit, not inherited
  - `twitter: { card: "summary_large_image", title, description }`
- [ ] `/terminos`, `/privacidad`, `/cookies` each gain in their `metadata` export:
  - `alternates.canonical` (absolute URL of the page)
  - `openGraph: { type: "website", url, title, description }`
  - `twitter: { card: "summary", title, description }` (the legal pages don't need a large image card)
- [ ] All other public pages (`/simulador`, `/como-funciona`, `/planes`, `/quienes-somos`, `/blog`, `/blog/[slug]`) gain a `twitter` block if missing — `/blog/[slug]` already has it; the rest get `summary_large_image` with the same title/description as their OG block
- [ ] No page on the public site is missing `alternates.canonical` after this spec

### F. Image & favicon hygiene (light touch)

- [ ] `<Image>` components in landing/marketing components (`HowItWorksSection`, `FeaturesBento`, `ReviewsCarousel`, `LandingFooter`, `quienes-somos/page.tsx`) all have descriptive `alt` text — empty `alt=""` is only allowed for purely decorative images. Audit by grep, fix any missing/empty alts where the image is meaningful
- [ ] No new favicon work — `icon.tsx` and `apple-icon.tsx` are already in place

### G. Verification (manual, before merge)

- [ ] Each new JSON-LD block (`Organization`, `WebSite`, `HowTo` on `/como-funciona`, `BreadcrumbList` on a representative `/blog/[slug]`) passes https://search.google.com/test/rich-results without warnings or errors [SEO audit]
- [ ] `/robots.txt` (Next-generated from `robots.ts`) is fetched on the deployed staging URL and visually confirmed to contain `Disallow: /panel`, `Sitemap: https://desgrava.ar/sitemap.xml`, etc.
- [ ] `/sitemap.xml` is fetched on staging and contains all expected URLs (home, simulador, como-funciona, planes, blog index, all blog posts, quienes-somos, terminos, privacidad, cookies) — count must match what `getAllPosts()` returns + 9 static entries
- [ ] After deploy to prod: resubmit sitemap in Google Search Console (operational, not a CI check)

### H. Tests

- [ ] No new tests required for metadata exports or JSON-LD blocks — they're presentational. CLAUDE.md scopes the testing mandate to `src/lib/` and `src/hooks/` modules, and this spec doesn't add either
- [ ] If a `getStaticPagesSitemap()` helper or a `buildBreadcrumbJsonLd()` helper ends up in `src/lib/seo/` during implementation, add a unit test for it then. Otherwise inline in the page

## Technical Notes

### File changes

- **New** `src/app/robots.ts` — exports `MetadataRoute.Robots` with the rules above
- **New** `src/components/seo/site-jsonld.tsx` — server component emitting `Organization` + `WebSite` JSON-LD `<Script>` tags. Imported once from `src/app/layout.tsx`
- **Edit** `src/app/layout.tsx` — render `<SiteJsonLd />` inside `<body>` (or `<head>` via `next/script` — both work for JSON-LD as long as it's in the initial HTML response)
- **Edit** `src/app/sitemap.ts` — replace `new Date()` with stable per-route timestamps (per-post date, max-post date for blog index, hardcoded legal date for legal pages)
- **Edit** `src/app/page.tsx` — add `export const metadata: Metadata = {...}` block
- **Edit** `src/app/(public)/terminos/page.tsx`, `privacidad/page.tsx`, `cookies/page.tsx` — extend `metadata` export with `alternates.canonical`, `openGraph`, `twitter`
- **Edit** `src/app/(public)/simulador/page.tsx`, `como-funciona/page.tsx`, `planes/page.tsx`, `quienes-somos/page.tsx`, `blog/page.tsx` — add `twitter` block to existing `metadata`
- **Edit** `src/app/(public)/como-funciona/page.tsx` — render new `HowTo` JSON-LD `<Script>` inline (mirrors how `/simulador` already renders the FAQ JSON-LD inline)
- **Edit** `src/app/(public)/blog/[slug]/page.tsx` — render new `BreadcrumbList` JSON-LD next to the existing `ArticleJsonLd`
- **Edit** `src/app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx` — add `metadata.robots.index = false`. `/login` is left alone

### Why JSON-LD goes in initial HTML, not `afterInteractive`

The existing `ArticleJsonLd` component on `/blog/[slug]` uses `<Script strategy="afterInteractive">`. That works in practice because Googlebot executes JS, but it's needlessly fragile — some crawlers don't execute JS, and even Googlebot prefers schema in the initial HTML. New schema added in this spec uses inline `<Script>` (no `strategy` prop, which defaults to rendering in `<body>` synchronously) or the equivalent `<script type="application/ld+json" dangerouslySetInnerHTML={...} />`. Don't refactor the existing `ArticleJsonLd` strategy in this spec — leave it as is to keep the diff surgical [SEO audit].

### Why `WebSite` schema does NOT include `SearchAction`

A `WebSite` schema with `potentialAction: SearchAction` tells Google "this site has a search box, surface it as a sitelinks searchbox in results." `desgrava.ar` does not have an internal search at the moment. Emitting a `SearchAction` that points at a non-existent or broken `?q=` URL risks a Google manual action for misleading structured data. Skip it. If we add a real search later (e.g., across blog posts), revisit then.

### Why `lastModified` stability matters

Google ignores `<lastmod>` values in sitemaps when they change on every fetch — it interprets the noise as the site lying about updates. Stamping `new Date()` on every request defeats the purpose of the field. Stable values per actual content (post date for posts, max-post date for the blog index, hardcoded legal date for legal pages, build date for everything else) are what the protocol expects. The `SITE_LAST_BUILT` constant captured at module load gives us a value that's stable across requests within a single deploy, which is good enough for marketing pages with no per-content date.

### Why no per-post OG images

Was explicitly out of scope per the clarifying-questions answer. The default `src/app/opengraph-image.tsx` is good enough for now. Revisit when blog post count is large enough that per-post images would meaningfully lift CTR.

### Why no Core Web Vitals / performance work

Was explicitly out of scope per the clarifying-questions answer. The hygiene additions in this spec do not introduce new render-blocking JS or CLS shifts (JSON-LD blocks render synchronously and have zero visual cost). If a future spec wants to chase CWV, this is decoupled from it.

### Why `HowTo` on `/como-funciona` only (not `/simulador`)

`/simulador` is a calculator, not a procedural how-to. Adding `HowTo` there would be misleading. `/como-funciona` is verbatim a step-by-step explanation of the product, so the schema accurately describes the content.

## Out of Scope

- Programmatic SEO pages (`/calculadora/[ciudad]`, `/deducciones/[categoria]`, etc.) — separate spec
- Per-post OG images via `@vercel/og` — separate spec, blog post count is too low to matter today
- Core Web Vitals / performance optimization (LCP, INP, CLS) — separate spec
- New content pages (e.g., `/preguntas-frecuentes`, `/glosario`, `/comparar-con-contador`) — separate spec
- Internal-search functionality + corresponding `SearchAction` JSON-LD
- `SoftwareApplication` / `WebApplication` schema on `/` — overlaps with `Organization`, low signal for B2C SaaS, not worth the maintenance cost yet
- `Review` / `AggregateRating` schema — we have no real reviews/ratings, faking them is a manual-action risk
- Refactoring the existing `ArticleJsonLd` `strategy="afterInteractive"` to inline — keep diff surgical, only add new schema
- Per-blog-post `dateModified` (would need a Git-derived field or a frontmatter addition) — `datePublished` only is fine
- Hreflang tags — site is Spanish-AR only, no other language variants exist
- Sitemap index files (`<sitemapindex>`) — flat sitemap is fine under the 50k URL limit
- `priority` field experimentation in the sitemap — Google has publicly said they ignore it; keep current values, don't churn
- Removing `/login` from indexable surfaces — explicit decision to keep it crawlable as a brand entry point
- Adding a `noindex` to any page currently in the sitemap — sitemap and `noindex` conflict and confuse crawlers
- Submitting sitemap to Bing/Yandex/etc. — Argentine SEO traffic is overwhelmingly Google
- Search Console verification meta tag — already done out-of-band by the operator (verify presence, do not change)
- Image `<picture>` with WebP/AVIF sources — Next/Image already handles this transparently
- Schema validation in CI (e.g., a custom test that snapshots the JSON-LD output) — manual Rich Results Test sign-off is sufficient at this scale
