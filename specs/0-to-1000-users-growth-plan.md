---
title: 0-to-1000 Users Plan — Activation Funnel & Acquisition Channels for Argentina
status: draft
priority: high
---

## Summary

desgrava.ar is post-MVP — simulador, ARCA imports, SiRADIG automation and MercadoPago billing all work — but only family beta-testers and ~zero paying subs. This spec defines the operating plan and in-product surfaces to reach **1,000 active paying subscribers by 2027-04-30** (12 months from today, anchored to one full Argentine fiscal-year cycle). It instruments a 6-stage activation funnel from "/simulador visit" to "first paid renewal," concentrates acquisition on three channels (founder-led X AR, programmatic SEO, paid Meta/Google AR), and ships the in-product loops needed to make those channels compound: post-simulador share card, referral program with recurring credit, activation analytics events, Sean Ellis PMF survey, and a contador fake-door waitlist. Activation North Star is **first successful SiRADIG submission within 14 days of signup** — the only event that proves the product worked end-to-end. [Lenny: Sean Ellis activation framework; Grant Lee on word-of-mouth as the prerequisite for paid spend; Jason Cohen on channel concentration]

## Goals & North Star

- **Goal**: 1,000 active paying subscribers (TRIALING → ACTIVE conversion + first renewal) by 2027-04-30.
- **North Star activation event**: a user submits at least one deductible invoice to SiRADIG (a `SUBMIT_INVOICE` job in `COMPLETED` state) within **14 days of signup**.
- **Word-of-mouth gate before scaling paid (Grant Lee, Gamma)**: organic + referral signups must be ≥25% of weekly new signups before paid spend exceeds test budget. Below the gate, paid is research, not acquisition. [Lenny: Grant Lee on validating WOM before paid spend]

## Acceptance Criteria

### A. Activation funnel definition + tracking

- [ ] All 6 funnel stages emit Umami custom events with consistent naming:
  - `funnel_visit_simulador` (anonymous landing on `/simulador`)
  - `funnel_simulador_result` (calculator returned a savings figure)
  - `funnel_signup_completed` (User row created — fired in NextAuth `signIn` callback)
  - `funnel_arca_connected` (first successful credentials validation in `/api/credenciales/validar`)
  - `funnel_first_invoice_imported` (user's first `Invoice` row exists, regardless of source)
  - `funnel_first_siradig_submission` ⭐ activation (first `SUBMIT_INVOICE` job in `COMPLETED`)
  - `funnel_paid_conversion` (subscription transitions from TRIALING → ACTIVE)
- [ ] Each event sends `utm_source` / `utm_medium` / `utm_campaign` from the user's first-touch attribution (stored on `User.firstTouchAttribution Json?` at signup).
- [ ] An Umami dashboard with funnel breakdown by source/medium/campaign is documented in `docs/growth-funnel.md`.
- [ ] Initial benchmarks (revisable after data): visit→result 60% / result→signup 18% / signup→ARCA 65% / ARCA→first import 80% / first import→first submission 70% / activated→paid 30%.

### B. Post-simulador "share your savings" artifact

- [ ] After `/simulador` returns a savings figure, a `Compartir mi ahorro` button appears next to the existing CTAs.
- [ ] Clicking it generates a 1080×1080 PNG card on the server (`/api/simulador/share-card?amount=...&v=<short>`) showing: bucketed refund amount in ARS (e.g. "Recupero $487.000 con desgrava.ar"), short tagline, logo, footer URL `desgrava.ar/s/<short>`.
- [ ] `desgrava.ar/s/<short>` 302-redirects to `/simulador?utm_source=share&utm_medium=user&utm_campaign=savings_card&v=<short>`.
- [ ] Card is rendered with `@vercel/og` / satori-style server rendering — no headless browser.
- [ ] Card omits all PII: only the bucketed amount + a hashed short id. The exact amount is never persisted or rendered.
- [ ] One-tap share: native Web Share API on mobile; "copiar link" + WhatsApp / X / Telegram quick-share buttons on desktop.
- [ ] Each share writes a `SimulatorShare` row (id, amountBucket, shortCode, ipHash, createdAt) so we can attribute downstream signups via `v=<short>`.
- [ ] The card design must be screenshot-worthy without context — bold amount, clean typography, brand pop. [Lenny: Elena Verna on word-of-mouth loops requiring genuinely shareable moments]

### C. Referral program

- [ ] Each authenticated user has a unique referral link `desgrava.ar/r/<code>` shown on `/configuracion` and inside the post-onboarding completion modal.
- [ ] The link 302-redirects to `/login?ref=<code>` and stamps a `signup_ref_code` cookie (180 days). At signup, the cookie populates `User.referredByUserId`.
- [ ] **Reward design — recurring product needs recurring reward**: when a referee reaches activation (first SiRADIG submission), the referrer's MercadoPago `Preapproval` next billing period is automatically extended by 30 days via the existing `/api/webhooks/mercadopago` flow. Cap: 12 months of credits per inviter per fiscal year. [Lenny: Duolingo's referral failure — Uber-style rewards don't work for non-pay-as-you-go products]
- [ ] The referee gets an extended 60-day trial (vs. standard 30).
- [ ] A `/configuracion` "Invitá a un amigo" card shows: the link, copy button, count of referrals (signups / activated / rewards earned), and total credit days banked.
- [ ] An email triggers when a referral activates ("Tu amigo ya presentó su primera deducción — sumaste 30 días gratis").
- [ ] Anti-abuse: same `User.identityCuit`, same payment method, or matching IP class blocks reward. Self-referral (referredByUserId == userId) blocked at signup.

### D. Sean Ellis PMF survey

- [ ] 24h after the first SiRADIG submission, on next dashboard visit, a one-question modal appears once: "Si mañana desgrava.ar dejara de existir, ¿cómo te sentirías?" with options "Muy decepcionado / Algo decepcionado / No me importaría". [Lenny: Sean Ellis "very disappointed" PMF question]
- [ ] Optional follow-up text field "¿Qué te haría falta para que sea imprescindible?" submits in the same form.
- [ ] Responses store on `PMFSurveyResponse` (userId, response, freeText, createdAt). Skip allowed; modal does not reappear.
- [ ] An admin view at `/admin/pmf` (gated to admin emails) shows rolling 30-day breakdown — "muy decepcionado" % is the leading indicator.
- [ ] Hard gate before scaling paid spend beyond test budget: ≥40% "muy decepcionado". [Lenny: Sean Ellis 40% threshold]

### E. Contador fake door

- [ ] Landing-page pricing section gains a fourth tier: "Contadores — Gestiona deducciones para todos tus clientes en un solo lugar" with CTA "Anotate en la lista de espera".
- [ ] CTA opens a Dialog asking: nombre, email, CUIT (optional), cantidad de clientes, "¿qué herramienta usás hoy?". Submission writes a `ContadorWaitlistEntry` row.
- [ ] On submit, the user sees: "Te avisamos cuando esté listo. Mientras tanto, ¿querés probar la versión personal gratis 30 días?" with a CTA to `/login`.
- [ ] An email notifies `SUPPORT_EMAIL` for each new waitlist entry.
- [ ] No multi-CUIT product is built. This is a fake door. [Lenny: Jen Abel — sell the alpha, learn from the rejection signal before building]
- [ ] **Documented decision rule**: build the contador product only if ≥75 verified waitlist entries land within 90 days AND the form's "cantidad de clientes" sums to ≥1,000 prospective end-users.

### F. Channel 1 — Founder-led X (Twitter) AR

Operating cadence + a few small touchpoints. Output is mostly docs.

- [ ] `docs/growth/x-playbook.md` documents: 3 posts/week minimum, ≥1/week "build in public" thread (metric, lesson, dashboard screenshot), ≥1/week tax-tip thread tied to AR fiscal calendar (deadlines, gotchas, what's deductible).
- [ ] Every link from a tweet uses `?utm_source=twitter&utm_medium=organic&utm_campaign=<thread-slug>`. UTMs are captured by Umami (already in place).
- [ ] Templates committed to `docs/growth/x-templates/` for: weekly metrics thread, milestone-public posts ("100 usuarios", "primer pago", "$1M en deducciones procesadas") gated on real metric thresholds. [Lenny: Grant Lee on founder-led marketing — break through noise yourself before delegating]
- [ ] Targets: 500 followers at 90 days, 2,000 at 12 months; 8% of signups attributed to `utm_source=twitter` over a rolling 30-day window.
- [ ] **Out**: no paid X ads in this phase.

### G. Channel 2 — Programmatic SEO

- [ ] New public route `src/app/(public)/calculadora/[slug]/page.tsx` generates SEO pages from a static dataset at `src/lib/growth/seo-pages.ts`.
- [ ] Initial set ≥40 pages: profession × scenario × salary-bracket combinations (e.g. `/calculadora/programador`, `/calculadora/medico`, `/calculadora/sueldo-2-millones`, `/calculadora/alquiler-deducible`, `/calculadora/empleados-domesticos`, `/calculadora/cargas-de-familia`, `/calculadora/educacion-hijos`). [Lenny: Ethan Smith on programmatic SEO — auto-generate landing pages for high-volume tail keywords]
- [ ] Each page renders: tailored H1, 300–500 word intro answering the keyword's question, embedded simulador pre-filled with the scenario's defaults, "Otros cálculos" internal-link block (6 related slugs).
- [ ] Pages are statically generated (`generateStaticParams`) with per-page `metadata` (title, description, canonical, OG image — reuse share-card component).
- [ ] `sitemap.xml` and `robots.txt` include the SEO pages and `/simulador`.
- [ ] `LD-JSON FAQPage` schema embedded on every SEO page (3–5 Q&A pairs per slug).
- [ ] AEO-friendly: short declarative answer paragraphs in first 200 words, named entities ("AFIP", "ARCA", "F.572 web") used naturally. [Lenny: Ethan Smith on AEO — head of search is now answer-shaped, not link-shaped]
- [ ] Page CTAs ("Calculá ahora" / "Empezá gratis") pass `utm_source=seo&utm_medium=organic&utm_campaign=<slug>`.
- [ ] Targets: 25k organic visits/month at 6 months, 80k/month at 12; ≥35% of signups from `utm_source=seo`.

### H. Channel 3 — Paid Meta/Google AR

- [ ] `docs/growth/paid-playbook.md` commits the campaign structure, audiences, and budget guardrails — source of truth for the founder running ads.
- [ ] **Google Ads**: search-intent campaigns on bracketed AR keywords ("deducciones ganancias", "f572 web siradig", "como cargar siradig", "calculadora ganancias 2026"). Single-keyword ad groups; landing pages = matching `/calculadora/<slug>` SEO page (intent → page tight match).
- [ ] **Meta Ads**: retargeting only for first 60 days — audience = anyone who hit `/simulador` and didn't sign up within 7 days. Creative = share-card design + per-profession variants.
- [ ] All paid links pass `?utm_source={google|meta}&utm_medium=cpc&utm_campaign=<slug>&utm_content=<creative-id>`.
- [ ] Conversion events sent to Meta and Google for `funnel_signup_completed` and `funnel_first_siradig_submission` via Conversions API (server-side from Next API routes — not pixel only).
- [ ] **Budget guardrail**: paid spend capped at ARS $80k/month while activation rate (signup → first submission within 14 days) is below 35% (rolling 14-day window). Above 35%, expand to ARS $400k/month max in this phase. [Lenny: Grant Lee — don't pour money into a leaky bucket]
- [ ] Unit-economics gate before further scaling: blended CAC ≤ 4 monthly subscriptions of payback, target LTV ≥ 18 months.
- [ ] Target mix at 12 months: ≤25% paid; remainder organic + referral + founder-led.

### I. Mobile / responsive

- [ ] Share button, share-card preview modal, "Invitá a un amigo" card, contador waitlist Dialog, and Sean Ellis modal all work at 320px with full-width sheet layouts on mobile and 44px minimum touch targets.
- [ ] Programmatic SEO pages reuse the existing landing layout — each slug's H1 must readably display in ≤2 lines on 320px.
- [ ] Sean Ellis modal radio options are 44px tap targets each.

## Technical Notes

### DB & API

- **Prisma additions**:
  - `User.firstTouchAttribution Json?` — `{ source, medium, campaign, content, landing, ts }`. Captured in NextAuth `signIn` callback by reading the `attribution` cookie planted by middleware.
  - `User.referredByUserId String?` — populated at signup if `signup_ref_code` cookie resolves.
  - `ReferralReward` (id, referrerUserId, refereeUserId, status[PENDING/CREDITED/REVOKED], creditDays, createdAt, creditedAt). One row per qualifying activation.
  - `SimulatorShare` (id, amountBucket, shortCode, ipHash, createdAt).
  - `PMFSurveyResponse` (id, userId, response, freeText, createdAt).
  - `ContadorWaitlistEntry` (id, name, email, cuit, clientCount, currentTool, createdAt).
- **New API routes**:
  - `GET /api/simulador/share-card?amount=&v=` — 1080×1080 OG image via `@vercel/og` / satori (Node runtime — runs fine on Fly).
  - `POST /api/simulador/share` — records `SimulatorShare`, returns `{ shortCode }`.
  - `GET /r/<code>` and `GET /s/<short>` — Next route handlers, 302 with cookie + UTM stamping.
  - `POST /api/referral/extend` — internal, called from the SUBMIT_INVOICE success branch, credits the referrer's MercadoPago preapproval period.
  - `POST /api/pmf` — writes a survey response.
  - `POST /api/contador-waitlist` — writes a waitlist entry, emails `SUPPORT_EMAIL`.
- **Existing routes touched**:
  - `/api/credenciales/validar` — emit `funnel_arca_connected`.
  - `/api/automatizacion` — in `SUBMIT_INVOICE` success branch, emit `funnel_first_siradig_submission`, schedule the 24h-delayed Sean Ellis trigger, and trigger referral reward when applicable.
  - `/api/webhooks/mercadopago` — on subscription transition, emit `funnel_paid_conversion` and apply pending `ReferralReward.creditDays`.

### Attribution capture

- New `src/middleware.ts` rule: when any `utm_*` is in the URL and the `attribution` cookie is unset, write a 90-day signed cookie with `{ source, medium, campaign, content, landing, ts }`. NextAuth `signIn` callback reads it and persists to `User.firstTouchAttribution`.
- Umami is already loaded site-wide (per `umami-cloud-analytics-channel-attribution.md`). Custom events fire via `window.umami.track('event_name', { props })` from client components, or via Umami HTTP API from server routes.

### Share-card rendering

- `@vercel/og` with site fonts loaded server-side. Cache to `/tmp/share-cards/<short>.png` with 30-day eviction; regenerate on miss. No CDN at this scale.
- Amount is bucketed (rounded to nearest $50k under $500k, nearest $100k above). Exact amount is never stored or rendered.

### Programmatic SEO data model

- `src/lib/growth/seo-pages.ts` exports a typed `SeoPage[]`:
  ```ts
  type SeoPage = {
    slug: string;
    title: string;
    h1: string;
    metaDescription: string;
    introMd: string;
    simulatorDefaults: { profession?: string; salary?: number };
    relatedSlugs: string[];
    faqs: Array<{ q: string; a: string }>;
  };
  ```
- The route component looks up the page, renders the embedded simulador (reuse `<SimuladorEmbed>` from existing landing) pre-filled with `simulatorDefaults`, and renders the FAQ + LD-JSON.
- `sitemap.xml` is generated by reading the same array.
- Initial 40 slugs ship in the spec PR; adding new slugs later is a data-only change.

### Activation event wiring

- Funnel events are sent from the existing call sites where state already changes — no separate orchestrator. Each event includes attribution from `User.firstTouchAttribution` (server-side) so attribution is consistent across stages even months later.
- The activation event (`funnel_first_siradig_submission`) firing in the `SUBMIT_INVOICE` success branch is the same hook that triggers referral credit and schedules the Sean Ellis survey.

### Why these 3 channels and not others

- **Founder-led X**: high-conviction, low-cost, builds the WOM bedrock paid needs. [Lenny: Grant Lee on founder-led marketing]
- **Programmatic SEO**: highest-margin acquisition for tax-calculator intent — high-intent, evergreen, AR-specific keywords have low competition. [Lenny: Ethan Smith programmatic SEO + AEO]
- **Paid Meta/Google**: the only channel with a real dial — added last, gated on activation rate. [Lenny: Jason Cohen on channel concentration — every business has 1-2 dominant channels; sprinkling everywhere is a tax]
- **Explicitly de-prioritized this phase**: contadores referral (validated by fake door first), Instagram AR (creator-heavy, slow), WhatsApp groups (low-trust at zero-brand stage), payroll fintech partnerships (BD heavy, slow).

### Mobile-first

Design every new surface (share button, share-card modal, "Invitá a un amigo" card, contador waitlist Dialog, Sean Ellis modal) at 320px first; enhance with `sm:` / `md:`. Modals are full-bleed sheets on mobile, centered cards on desktop. Tap targets ≥44px.

### Tests

- `src/lib/growth/__tests__/attribution.test.ts` — middleware cookie parsing + first-touch precedence.
- `src/lib/growth/__tests__/referral-rewards.test.ts` — eligibility (self-ref blocked, duplicate IP blocked, only credits on activation, cap respected).
- `src/lib/growth/__tests__/seo-pages.test.ts` — every slug has required fields and FAQ count, related-slug graph has no broken refs.
- `src/app/api/simulador/share/__tests__/share.test.ts` — bucket rounding, hash stability.
- `src/app/api/pmf/__tests__/pmf.test.ts` — one response per user (idempotent), schema validation.

## Out of Scope

- A built contador product (multi-CUIT, multi-client dashboard, agente-de-retención workflows). The fake door tests demand only.
- Influencer/creator partnerships, Instagram organic, WhatsApp/Telegram channel posting, podcast sponsorships.
- Affiliate program for non-customers (creators, contadores without a desgrava.ar account). The referral program covers customer-to-customer only.
- Self-hosting Umami or migrating off Umami Cloud.
- A/B testing infrastructure (GrowthBook, Optimizely). UTM-based cohort comparison via Umami is sufficient at this volume.
- Email lifecycle / nurture campaigns. Transactional email already exists via Resend; lifecycle deferred.
- Multi-currency / non-AR localization. Argentina only.
- App store presence (iOS/Android). Web PWA only.
- Server-side ad attribution beyond the Conversions API send specified above. No data warehouse, no Segment/RudderStack pipeline.
- A "Compartir" feature for invoices or submissions. Only the simulador share artifact is in scope.
- A custom in-app analytics dashboard. Whatever Umami provides + `docs/growth-funnel.md` is sufficient.
