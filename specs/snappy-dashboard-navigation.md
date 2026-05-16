---
title: Snappy Dashboard Navigation (Performance Overhaul)
status: implemented
priority: high
---

## Summary

Production navigation through the authenticated app currently feels sluggish — every dashboard route hides a sequential session + user DB lookup waterfall before the first byte ships, the `/panel` page blocks on 13 parallel queries with no streaming, the ARCA progress strip re-polls `/api/automatizacion` every 4 seconds and downloads the full job history with `include` joins, three count contexts each fire their own HTTP request on mount, the Vercel deploy region (default `iad1`) is on the wrong continent from Supabase, the Next.js Router Cache and HTTP `Cache-Control` are both unused on hot reads, and several heavy client libraries ship in the initial bundle. This spec attacks each of those bottlenecks so navigating between dashboard routes feels instant — server fetches in parallel, payloads are minimal, the UI streams progressively, the browser and Next router reuse recent responses on back-nav, and the network distance between app and DB drops by hundreds of milliseconds.

## Acceptance Criteria

### Server-side data fetching

- [ ] Dashboard layout (`src/app/(dashboard)/layout.tsx`) does not chain a `prisma.user.findUnique` after `getServerSession` — the fields it needs (`onboardingCompleted`, `tourSeenAt`, `name`) are added to the NextAuth `session.user` via the `session` / `jwt` callback in `src/lib/auth.ts` so the layout renders from the JWT alone
- [ ] `src/app/(dashboard)/panel/page.tsx` no longer calls `getServerSession()` a second time — the session is read via a memoized `getSession()` helper shared with the layout
- [ ] `/panel` is split into independent `<Suspense>` boundaries so the page shell + greeting render on first byte; metrics, monthly chart, and "comprobantes recientes" each stream in independently with skeleton fallbacks
- [ ] All three dashboard count contexts (`AttentionCountsProvider`, `DomesticWorkerCountProvider`, `EmployerCountProvider`) are consolidated behind a single `/api/panel/counts` endpoint that returns `{ attention, domesticWorkers, employers }` in one round trip, and a single combined provider is mounted in `DashboardShell`
- [ ] `getServerSession` results are de-duplicated within a single request via React `cache()` so any helper that needs the session reads the same memoized result

### Polling endpoint

- [ ] `GET /api/automatizacion` (no `?activeJob=`): adds a `createdAt >= now() - interval '24h'` filter, replaces `include: { invoice: {...} }` with a typed `select` covering only fields the UI reads (`id`, `jobType`, `status`, `currentStep`, `currentStepStartedAt`, `createdAt`, `completedAt`, `fiscalYear`, `notifyOnComplete`, plus a `select`'d invoice with just `providerName`, `providerCuit`, `invoiceNumber`, `invoiceDate`, `amount`, `deductionCategory`)
- [ ] `useArcaImportProgress` polls every 4s only when `snapshot` or `queueState` has at least one PENDING/RUNNING job; backs off to 30s when nothing is active; uses the existing `enqueueAutomationJob` to wake polling on action
- [ ] The hook resumes the 4s cadence immediately on user-driven enqueue (already implemented via `refreshArcaProgress()`) without waiting out the 30s tick
- [ ] No-op polls (idle backoff) do not refresh React state if the response is byte-identical to the last successful response (cheap reference check on the JSON string)

### Client caching

- [ ] `next.config.ts` enables Next's Router Cache for dynamic segments (e.g. `experimental.staleTimes: { dynamic: 30, static: 180 }`, or the Next 16-promoted equivalent — verify against the installed `next` version) so navigating back to a recently-visited dashboard route serves the cached RSC payload instantly while revalidating in the background
- [ ] `GET /api/panel/counts` returns `Cache-Control: private, max-age=5, stale-while-revalidate=30`
- [ ] `GET /api/automatizacion`: when the response contains zero PENDING/RUNNING jobs returns `Cache-Control: private, max-age=10, stale-while-revalidate=30`; when any non-terminal job is present returns `Cache-Control: no-store` so polling always sees fresh state
- [ ] All `Cache-Control` headers added in this spec are `private` (never `public`) — verified by unit tests on the route handlers so a future change can't accidentally let an intermediate CDN cache per-user data
- [ ] DevTools Network panel verification: back-nav between `/panel` ↔ `/comprobantes` within ~10s shows the API GETs served `(from disk cache)` / `(from memory cache)` and the RSC payloads served from the router cache

### Region + connection

- [ ] `vercel.json` declares `"regions": ["gru1"]` so the Next.js runtime co-locates with Supabase in São Paulo; verify via Vercel deployment metadata and a one-shot measurement that DB-round-trip-bound endpoints (`/api/automatizacion`, `/api/comprobantes?page=1`) drop by ≥100ms P75 vs. pre-change baseline
- [ ] After region change, confirm the cron endpoints still execute under their schedule (Vercel Crons remain region-pinned to the deploy region)
- [ ] `src/lib/prisma.ts` is documented as the singleton entry point; no changes to the adapter or connection string required

### Database indexes

- [ ] Prisma migration `add-perf-indexes` adds:
  - `Invoice @@index([userId, fiscalYear, invoiceDate(sort: Desc)])` — backs the main `/api/comprobantes` list query
  - `Invoice @@index([userId, fiscalYear, deductionCategory])` — backs the panel's category-filtered counts and groupBy
  - `AutomationJob @@index([userId, jobType, status])` — backs the polled GET and the per-type active-job lookup
  - `DomesticReceipt @@index([userId, fiscalYear, siradiqStatus])` — backs the recibos list filter
- [ ] Migration runs in production via `prisma migrate deploy` during the next build; no manual DBA steps required
- [ ] Existing indexes that the new composite indexes fully cover are removed to keep write amplification low (verify with `EXPLAIN` that the new ones serve the old query patterns)

### Client bundle

- [ ] `canvas-confetti` is loaded via `await import("canvas-confetti")` inside the event handlers in `src/components/facturas/invoice-list.tsx` and `src/components/onboarding/dashboard-tour.tsx`, not as a top-of-file static import
- [ ] `react-easy-crop` is loaded via `next/dynamic` (with `ssr: false`) inside `src/components/configuracion/avatar-crop-dialog.tsx` so the configuracion page no longer ships the cropper until the user opens the dialog
- [ ] `next/font` declarations for `Geist` and `Geist_Mono` in `src/app/layout.tsx` include `display: "swap"`
- [ ] Sidebar and header `<Link>` items keep Next.js's default prefetch behavior; document via a brief code comment if any link intentionally opts out

### UI + responsiveness

- [ ] Skeleton loaders for the streamed `/panel` sections match the final content height to within 8px so there is no cumulative layout shift on hydration
- [ ] All skeleton loaders work on screens as narrow as 320px and respect the existing `bg-muted` / `bg-gray-100` tokens

### Verifiable outcome

- [ ] Vercel Speed Insights (or an equivalent ad-hoc measurement run) reports P75 INP for `/panel`, `/comprobantes`, `/recibos` under 200ms post-deploy
- [ ] P75 total navigation time between `/panel` → `/comprobantes` → `/recibos` (measured by the Performance API `navigation` entry on a clean Chrome profile, 4G throttling, 5 runs) drops by ≥40% vs. a pre-change run on the same hardware

## Technical Notes

### NextAuth session payload

Extend `src/lib/auth.ts` `session` + `jwt` callbacks to put `onboardingCompleted` and `tourSeenAt` (as a boolean `tourSeen`) on `session.user`. The values are read on every layout render but only change on a handful of explicit user actions (`POST /api/tour/complete`, `POST /api/onboarding/complete`, `POST /api/tour/replay`); those routes already trigger `router.refresh()` or set a new session via `update()` so the JWT stays fresh. Add a typed augmentation in `src/types/next-auth.d.ts` (or wherever the existing module declaration lives).

### React `cache()` for session

Wrap `getServerSession(authOptions)` in `cache()` and export a `getSession()` helper from `src/lib/auth.ts`. Server components and route handlers in the same request that need the session call `getSession()`; React de-duplicates. This is the standard NextAuth + RSC pattern and removes the redundant call in `/panel/page.tsx` and anywhere else.

### Suspense streaming on `/panel`

Split the panel page into:

- `<PanelHeader firstName={…} />` — synchronous, renders immediately
- `<Suspense fallback={<MetricsSkeleton />}><Metrics /></Suspense>` — awaits the 6 count queries
- `<Suspense fallback={<ChartSkeleton />}><MonthlyChart /></Suspense>` — awaits `monthCategoryBreakdown` + `receiptMonthBreakdown`
- `<Suspense fallback={<RecentInvoicesSkeleton />}><RecentInvoices /></Suspense>` — awaits the `findMany take: 6`
- `<Suspense fallback={<ProximoPasoSkeleton />}><ProximoPaso /></Suspense>` — derived state from counts

Each child is an `async` server component that does its own `prisma` call. Next will start streaming the shell before the queries complete. The current `Promise.all` is fast but the 13th query still blocks paint of the first 12.

### Consolidated counts endpoint

`/api/panel/counts` returns `{ attention: { reviewNeeded, missingMonth, … }, domesticWorkers, employers }` in a single Prisma `$transaction([...])` or sequential awaits on the same connection. The combined provider is a server-component wrapper that fetches once and feeds the three legacy context shapes for backwards compat with consumers, or a single new `<PanelCountsProvider>` if we're willing to migrate consumers.

### Polling backoff state machine

In `src/hooks/use-arca-import-progress.ts`, compute `pollIntervalMs` from `snapshot` + `queueState`:

- Any RUNNING job → `4_000`
- Any PENDING job → `4_000`
- All terminal / nothing active → `30_000`

Setting the interval inside the existing polling loop (`setTimeout` recursive) avoids the React effect churn of swapping intervals.

### Client caching: Next Router Cache

Enable `staleTimes` in `next.config.ts`:

```ts
experimental: {
  staleTimes: { dynamic: 30, static: 180 },
}
```

This keeps the last RSC payload of a dynamic segment usable for 30 seconds on the client. Combined with Suspense streaming, returning to `/panel` after a quick detour to `/comprobantes` will paint instantly from the router cache while the new data revalidates in the background. The flag is `experimental` as of Next 15 — verify the exact location against `next@16.1.6` and adjust if Next 16 has promoted or renamed it (`cacheComponents` / similar). When the user explicitly mutates server state (e.g. submitting a factura), the affected route handler should call `revalidatePath()` so the router cache invalidates immediately.

### Client caching: HTTP `Cache-Control`

Route handlers return a `Response` with `headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" }`:

- `private` because the data is per-user — never `public`, which would let Vercel's edge cache or any intermediate CDN serve one user's payload to another
- `max-age=5` short enough that the UI feels fresh
- `stale-while-revalidate=30` gives the browser permission to serve the last response immediately on a near-duplicate request while it revalidates in the background

For `/api/automatizacion`, branch on whether the response contains any non-terminal job: idle → `private, max-age=10, stale-while-revalidate=30`; active → `no-store` so the 4s poll always sees fresh state.

Add a small helper `withPrivateSWR(maxAge, swr)` in `src/lib/http/cache-headers.ts` so the header string is built consistently, and unit-test that every wrapped response includes `private`.

### `select` for the polled endpoint

Define a typed `JobSummary` shape in `src/lib/automation/job-summary.ts` and have both `GET /api/automatizacion` and the hook consume it. This keeps the wire shape narrow and gives us a single place to grow the surface as new fields are needed.

### Region pin

Add `"regions": ["gru1"]` to `vercel.json`. The Vercel Crons section already exists; cron schedules will continue to run from the new region. The Fly worker is already in `gru` and Supabase is on `sa-east-1`, so all three converge on São Paulo.

### Index migration safety

Use `prisma migrate dev --create-only` to generate the migration, then hand-edit to wrap `CREATE INDEX` calls with `CONCURRENTLY` (Postgres won't lock the table). `prisma migrate deploy` does not support concurrent index creation inside a transaction, so the migration must run statements outside a transaction (`-- prisma-engine: no-transaction` directive, or split into multiple migration files). Verify on a Supabase shadow DB or with a `--dry-run`.

### Dynamic imports

`canvas-confetti` example pattern:

```ts
async function fireConfetti() {
  const { default: confetti } = await import("canvas-confetti");
  confetti({
    /* ... */
  });
}
```

`react-easy-crop` example pattern:

```ts
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });
```

### Measurement

Use `window.performance.getEntriesByType("navigation")` on a clean Chrome profile (Lighthouse "Mobile" preset, Slow 4G throttling) to measure the before/after delta on `/panel` → `/comprobantes` → `/recibos`. Capture the median of 5 runs for each route. Optionally enable Vercel Speed Insights (`@vercel/speed-insights/next`) at the same time as the region change so we get production P75/P95 telemetry going forward — but this is a value-add, not a gate.

### Files Touched

- `src/lib/auth.ts` — JWT/session callbacks expose `onboardingCompleted` + `tourSeen`; export memoized `getSession()`
- `src/types/next-auth.d.ts` (or equivalent) — augment `Session` and `JWT` types
- `src/app/(dashboard)/layout.tsx` — drop the `prisma.user.findUnique` lookup, read from session
- `src/app/(dashboard)/panel/page.tsx` — Suspense splits, drop redundant session call, switch to streamed children
- `src/app/api/panel/counts/route.ts` — new consolidated counts endpoint with `Cache-Control` header
- `src/contexts/attention-counts.tsx`, `src/contexts/domestic-worker-count.tsx`, `src/contexts/employer-count.tsx` — consume the new endpoint (or replace with a single combined provider)
- `src/hooks/use-arca-import-progress.ts` — idle-backoff polling
- `src/app/api/automatizacion/route.ts` — `select` instead of `include`, 24h window, branching `Cache-Control`
- `src/lib/automation/job-summary.ts` — new typed projection shared by route + hook
- `src/lib/http/cache-headers.ts` — `withPrivateSWR` helper + tests
- `src/components/facturas/invoice-list.tsx`, `src/components/onboarding/dashboard-tour.tsx` — dynamic `canvas-confetti`
- `src/components/configuracion/avatar-crop-dialog.tsx` — dynamic `react-easy-crop`
- `src/app/layout.tsx` — `next/font` `display: "swap"`
- `next.config.ts` — `experimental.staleTimes` (or Next 16 equivalent)
- `vercel.json` — `"regions": ["gru1"]`
- `prisma/schema.prisma` + new migration — composite indexes
- New `__tests__/` for: `getSession` memoization, idle-backoff helper (`computePollInterval(snapshot, queueState)`), JobSummary projection shape, `withPrivateSWR` header builder, route-handler assertion that `Cache-Control` is always `private`

## Out of Scope

- Public marketing routes (`/`, `/simulador`, `/como-funciona`, `/planes`, `/blog`, `/quienes-somos`) — these have their own performance characteristics (Core Web Vitals, font/LCP, JS for the simulator) and warrant a separate spec focused on the unauthenticated visitor experience
- Replacing the polling architecture with SSE / WebSocket / Redis pub-sub push — bigger architectural change; the trim + backoff + SWR approach in this spec gets most of the win at far lower risk and can be revisited later if needed
- Migrating Supabase to a different region — both Vercel and Supabase are already on or moving to São Paulo / sa-east; only the Vercel side changes here
- Adopting SWR / React Query as a client data-fetching library — the Next Router Cache plus HTTP `Cache-Control` covers the same ground without a new dependency
- Reducing the number of `prisma` queries on `/panel` (they are already parallel and use indexes) — Suspense streaming is the better answer than fewer queries
- OCR / automation pipeline performance — covered by `optimize-arca-import-performance.md` and `optimize-automation-speed.md`
- API pagination changes on `/api/comprobantes` and `/api/recibos` — these already use server-side pagination via `usePaginatedFetch`
- Adding Vercel Speed Insights as a hard requirement (it's a "nice to have" called out in the measurement section; opt-in only if the user wants long-term telemetry)
- Touching the worker pool, Redis queue, or job processor
- Service Worker / offline / PWA caching strategies
