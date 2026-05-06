---
title: Migrate to Vercel + Supabase + Redis-queued Playwright workers
status: draft
priority: high
---

## Summary

Split desgrava.ar into a Vercel-hosted Next.js app, a Supabase Postgres database, and a horizontally-scalable pool of Playwright workers that consume jobs from a Redis-backed queue. The initial worker deployment is on Fly.io (`gru` region, Chromium-ready), but the worker is a generic Docker image with no Fly-specific assumptions: any number of additional workers can be brought up on a self-hosted box (or a different cloud) and they will compete for the same queue, scale capacity linearly, and let us drop Fly entirely if we ever choose to. PDFs move out of Postgres into Supabase Storage. A brief maintenance window is acceptable for the cutover.

## Acceptance Criteria

### Repo layout & build

- [ ] Single repo with two build targets:
  - Vercel deploys the Next.js app from the repo root
  - A generic worker Docker image is built from `worker/Dockerfile`; that image runs unchanged on Fly.io, on any VPS via `docker run`, and on any container platform (k8s, ECS, Docker Compose) — no platform-specific code paths in the worker itself
- [ ] Worker entrypoint at `worker/index.ts` imports from `src/lib/automation/`, `src/lib/prisma.ts`, `src/lib/crypto/`, etc. — no code duplication between Vercel and worker
- [ ] `worker/Dockerfile` includes only what the worker needs (Node + Playwright + Chromium + `src/lib/automation/` deps); image size kept manageable so it pulls quickly on cold worker boxes
- [ ] `fly.toml` updated to deploy the worker image to `gru` (≥2GB RAM for Chromium); worker is a non-HTTP process (`processes` group or no `[http_service]`), with internal `/health` for Fly health checks if Fly requires it — no public URL needed since workers PULL from the queue rather than receive webhooks
- [ ] `vercel.json` checked in with: `crons` config (replacing the three GH Actions cron workflows), function timeout overrides where needed (e.g. `/api/comprobantes/upload` for OCR up to 60s on Pro)
- [ ] Self-hosting runbook documented (in the PR description or a `worker/README.md`): minimum host requirements, the exact `docker run` command with required env vars, how to verify the worker has registered itself and started consuming, and how to gracefully drain it

### Database (Supabase)

- [ ] Supabase project provisioned in a region close to São Paulo (`sa-east-1` or `us-east-1`); free tier acknowledged (auto-pause after 7 days inactivity is accepted for now)
- [ ] `prisma/schema.prisma` `datasource db` uses both `url` (pooled, PgBouncer port 6543) and `directUrl` (direct, port 5432) — required for `prisma migrate` to work against Supabase
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) set on Vercel and on the Fly worker
- [ ] `PrismaPg` adapter in `src/lib/prisma.ts` verified to work with Supabase pooler in transaction mode (or switch to session mode if needed)
- [ ] Data migrated from Fly Postgres → Supabase via `pg_dump` + `pg_restore` during the maintenance window; row counts on every table verified post-migration
- [ ] `prisma migrate deploy` runs successfully against Supabase; `scripts/check-db.mjs` updated to recognize `supabase.co` URLs as remote

### File storage (Supabase Storage)

- [ ] Supabase Storage bucket `comprobantes` (private) created; service-role access only — no public reads
- [ ] `Invoice` and `DomesticReceipt` schemas gain a `fileStorageKey String?` column (path inside the bucket); `fileData Bytes?` and `fileMimeType` are kept during transition, dropped afterward in a follow-up migration
- [ ] One-shot migration script (`scripts/migrate-files-to-supabase.mjs` or similar) enumerates rows where `fileData IS NOT NULL`, uploads each blob to `comprobantes/<userId>/<recordId>.<ext>`, writes back `fileStorageKey`, runs idempotently
- [ ] Upload paths (`/api/comprobantes/upload`, `/api/recibos` upload, equivalent receipt endpoints) write the file to Supabase Storage and persist `fileStorageKey` instead of inline `fileData`
- [ ] File-serve paths (`/api/comprobantes/[id]/file`, `/api/recibos/[id]/file`) stream from Supabase Storage (using a signed URL or service-role download); auth check unchanged
- [ ] Deletion paths cascade-delete the Storage object when the row is deleted
- [ ] After migration is verified end-to-end, a follow-up Prisma migration drops `fileData` and `fileMimeType` (out of scope for this spec — note in PR description)

### Job dispatch (Redis queue, pull-based)

- [ ] New module `src/lib/queue/redis-queue.ts` exposing:
  - `publishJob(jobId: string)` — `LPUSH desgrava:jobs:queue <jobId>`; called from Vercel API routes
  - `consumeJob(): Promise<string | null>` — `BRPOP desgrava:jobs:queue 0` with a sane block timeout; called from the worker loop
  - `acquireUserLock(userId, ttlSec)` / `releaseUserLock(userId)` — Redis `SET <key> <token> NX EX <ttl>` and `DEL` (only if value matches the token)
- [ ] Both Vercel and the worker connect to the same Redis instance via a single `REDIS_URL` env var (Upstash Redis to start; identical client code works against any Redis 6+ — including self-hosted — so the queue host can be swapped without code changes)
- [ ] All current `after(() => processJob(jobId))` calls in API routes (15+ sites in `src/app/api/automatizacion/route.ts`, `src/app/api/presentaciones/enviar/route.ts`, `src/app/api/presentaciones/importar/route.ts`, `src/app/api/credenciales/validar/route.ts`, `src/app/api/onboarding/complete/route.ts`, `src/app/api/cron/presentaciones/route.ts`, `src/app/api/webhooks/telegram/route.ts`) replaced with `await publishJob(job.id)` so the work runs on a worker, not the Vercel function
- [ ] `after()` retained only for genuinely Vercel-local fire-and-forget work (e.g. email sends, Telegram notifications) that doesn't need Playwright
- [ ] Worker main loop:
  - `BRPOP` blocks until a `jobId` arrives
  - Loads the `AutomationJob` row to get `userId`
  - Attempts to `acquireUserLock(userId)` with a TTL longer than the worst-case job duration (e.g. 15 min)
  - If the lock is acquired: call `processJob(jobId)`, then release the lock
  - If the lock is NOT acquired (another worker is already busy with this user): re-publish the `jobId` with a small backoff so a different worker — or the same one later — can retry
  - Wraps every job in a try/catch that marks `AutomationJob` `FAILED` on uncaught errors (the existing `processJob` already does this internally; the loop's outer catch is a safety net)
- [ ] Worker exposes a configurable per-process concurrency (`WORKER_CONCURRENCY`, default 1, max documented based on Chromium memory footprint) — multiple in-flight jobs per worker, each gated by its own user lock
- [ ] Worker logs a startup line including a stable `WORKER_ID` (hostname or env-provided) so we can tell which worker picked up which job in the DB logs

### Multi-worker / hybrid hosting

- [ ] N worker processes (any mix of Fly machines + self-hosted boxes) can be running simultaneously against the same `REDIS_URL` and `DATABASE_URL` and they will safely share the load
- [ ] Per-user serialization is preserved across workers: a Redis distributed lock keyed by `userId` ensures that no two workers ever run a job for the same user in parallel (today's invariant from the in-process per-user `PQueue`)
- [ ] Redis distributed lock uses a unique token per acquisition; `releaseUserLock` is a Lua/`EVAL` `GET-then-DEL` that only deletes if the token matches, so a worker that times out and a new owner takes over can't accidentally release each other's locks
- [ ] Lock TTL is comfortably longer than the longest expected job; jobs that overrun extend the lock periodically (heartbeat) so the lock can't expire mid-execution
- [ ] Stuck-job sweeper runs as a Vercel Cron (e.g. every 5 min) at `/api/cron/sweep-stuck-jobs`: finds `AutomationJob` rows in `RUNNING` status whose `currentStepStartedAt` is older than a threshold (e.g. 20 min) and marks them `FAILED` with a "worker disappeared" log entry; this protects against orphaned jobs when a worker dies hard
- [ ] Worker handles `SIGTERM` / `SIGINT` gracefully: stops `BRPOP`-ing for new jobs, waits up to N seconds for the current job to finish (or releases the user lock so another worker can pick up the requeued work), then exits — important for clean rolling deploys on Fly and clean draining on a self-hosted box
- [ ] Adding a new self-hosted worker requires only: pulling the worker Docker image, setting `REDIS_URL`, `DATABASE_URL`, `DIRECT_URL`, `ENCRYPTION_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WORKER_ID`, `WORKER_CONCURRENCY` — no inbound network access required, no certificates, no DNS records
- [ ] Removing Fly entirely (replacing it with self-hosted workers) requires only: bring up self-hosted workers, scale Fly worker to 0 — no application code changes

### Cron migration

- [ ] `vercel.json` `crons` array replaces `cron-presentaciones.yml`, `cron-subscription-reminders.yml`, `cron-review-non-deductible.yml`, plus a new `sweep-stuck-jobs` cron (Vercel Cron hits the existing `/api/cron/...` endpoints with the `x-cron-secret` header; the secret moves to Vercel env vars)
- [ ] If Vercel cron count exceeds the project's plan limit, the lowest-priority cron stays on a GitHub Actions scheduled workflow as a fallback
- [ ] The three existing `.github/workflows/cron-*.yml` files are deleted (or reduced to a single overflow workflow if the plan limits force it)
- [ ] `/api/cron/presentaciones` continues to work end-to-end: it enqueues `SUBMIT_PRESENTACION` jobs via the Redis queue and any available worker processes them

### SSE log streaming removal

- [ ] `/api/automatizacion/[jobId]/logs/route.ts` deleted (in-memory `getJobLogs` / `getJobStatus` / `getJobStep` no longer reachable from Vercel after the split)
- [ ] In-memory `jobLogs` / `jobStatuses` / `jobSteps` Maps and the `getJobLogs` / `getJobStatus` / `getJobStep` / `clearJobLogs` exports removed from `src/lib/automation/job-processor.ts` (DB-persisted `currentStep` and `logs` JSON column remain — these are the source of truth)
- [ ] `EventSource` usage in `src/components/perfil/employers-section.tsx` (and any other consumers) replaced with the existing DB-polling pattern (e.g. `useArcaImportProgress` or polling `/api/automatizacion`)
- [ ] Manual smoke test: a long-running ARCA job still shows accurate `currentStep` updates in the dashboard via polling

### Domain & DNS

- [ ] Vercel project domain bound to `desgrava.ar` and `www.desgrava.ar` with TLS issued
- [ ] No public URL is required for workers (pull-based queue) — neither Fly nor self-hosted boxes need DNS records, Cloudflare CNAMEs, or TLS certs to receive work
- [ ] Cloudflare DNS updated: apex/`www` → Vercel; old Fly Next.js DNS records removed
- [ ] `NEXTAUTH_URL` and any hardcoded callback URLs (Google OAuth, MercadoPago `back_url`/`notification_url`, Telegram `setWebhook`) verified against `https://desgrava.ar`
- [ ] MercadoPago webhook (`/api/webhooks/mercadopago`) and Telegram webhook (`/api/webhooks/telegram`) confirmed reachable on Vercel

### Secrets

- [ ] Vercel env vars set: `DATABASE_URL` (Supabase pooled), `DIRECT_URL` (Supabase direct), `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_UMAMI_*`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Worker env vars (same set on every worker, Fly or self-hosted): `DATABASE_URL`, `DIRECT_URL`, `ENCRYPTION_KEY`, `OPENAI_API_KEY` (worker uses it for category classification during `PULL_COMPROBANTES`), `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WORKER_ID` (defaults to hostname), `WORKER_CONCURRENCY` (default 1), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (only if a worker code path ever reads/writes files; not required for current ARCA flows)
- [ ] `CLAUDE.md` Environment Variables section updated to list the new Vercel/worker/Redis/Supabase vars, note which side of the split each is required on, and call out that adding a self-hosted worker is purely an env-vars-and-`docker run` operation

### CI/CD

- [ ] `.github/workflows/ci.yml` continues to run lint + format + build + test on PRs (unchanged)
- [ ] `.github/workflows/deploy.yml` either:
  - removed entirely (Vercel auto-deploys from git push to `main`; Fly auto-deploys via a separate workflow), OR
  - kept as a thin "deploy worker image to Fly" workflow that runs after CI passes; Vercel deploy is handled by Vercel's git integration
- [ ] Worker Docker image is published to a registry (GHCR or Docker Hub) on every push to `main` so self-hosted operators can `docker pull` the same image Fly runs — keeps Fly and self-hosted on the same build artifact and avoids "works on Fly, broken on the VPS" drift
- [ ] First deploy to Vercel and Fly succeeds; the published worker image runs cleanly via `docker run` on a fresh box and starts consuming jobs from a test queue

### Cutover

- [ ] Production cutover runbook documented in the PR description: (1) freeze writes on current Fly app, (2) `pg_dump` → `pg_restore` to Supabase, (3) run `migrate-files-to-supabase.mjs`, (4) provision Redis (Upstash) and capture `REDIS_URL`, (5) deploy worker image to Fly, confirm it connects to Redis, (6) deploy app to Vercel, (7) flip Cloudflare DNS, (8) verify smoke flows, (9) optionally bring up a second self-hosted worker as a smoke test of the multi-worker invariant
- [ ] Post-cutover smoke test: login (Google + email), invoice upload + OCR + AI classification, manual `PULL_COMPROBANTES` via the ARCA progress strip end-to-end, manual `SUBMIT_INVOICE` end-to-end, MercadoPago checkout sandbox round-trip, support chat (Ganancio) sends a message and persists the conversation, two workers running simultaneously process two different users' jobs in parallel without colliding
- [ ] Rollback plan documented: keep the old Fly Next.js app + Fly Postgres intact for 1 week; if needed, revert Cloudflare DNS to the old Fly app

## Technical Notes

### Why this split

Vercel is excellent for Next.js but cannot run Playwright reliably (function time limits, no persistent Chromium, cold starts kill long jobs). Long-lived Linux boxes with Chromium are great for Playwright but overkill for serving a Next.js app. The natural cut is: **Next.js → Vercel, Playwright → worker pool**, glued by a queue. Supabase replaces self-managed Postgres. Redis replaces in-process `after()` for cross-host job dispatch.

We deliberately use a **pull-based** queue rather than QStash-style HTTP webhooks: with pull, any number of workers (Fly, self-hosted, mixed) can compete for the same queue with zero infra coordination. Workers don't need public URLs, DNS records, or TLS certs — they just need outbound network access to Redis and Postgres. That keeps Fly as one option among several, not a dependency.

### Same-repo, two-target pattern

Keep the Next.js app at the repo root. Add a `worker/` directory containing only the worker entrypoint and its Dockerfile. Both targets `import` from `src/lib/automation/`, `src/lib/prisma.ts`, `src/lib/crypto/`, `src/lib/catalog/`, `src/generated/prisma/`, etc. — these are pure TypeScript modules with no Next.js dependency. The worker's `tsconfig` and Dockerfile build only what's reachable from `worker/index.ts`, which keeps the worker image lean and avoids dragging in `next`, React, MDX, etc.

The worker entrypoint is a long-running Node process: connect to Redis, loop on `BRPOP`, dispatch each `jobId` to `processJob(jobId)` (the existing function in `src/lib/automation/job-processor.ts`, unchanged). No HTTP server is required for job dispatch. A tiny `GET /health` endpoint may be added if the host platform (Fly.io) requires HTTP health checks; self-hosted operators can rely on process-level health (systemd, Docker `HEALTHCHECK`, k8s liveness on a TCP port, etc.).

### Redis queue flow

```
Vercel API route                Redis (Upstash or self-hosted)        Worker pool (Fly + self-hosted)
─────────────────               ──────────────────────────────        ───────────────────────────────
1. create AutomationJob row
2. publishJob(jobId)
   = LPUSH desgrava:jobs <id>  ►  desgrava:jobs:queue   [<id>, ...]
                                                                       3. BRPOP desgrava:jobs:queue
                                                                       4. SETNX user-lock:<userId>
                                  desgrava:user-lock:<u>  <token>  ◄  5. lock held
                                                                       6. processJob(jobId)
                                                                       7. update DB rows
                                                                       8. DEL user-lock:<userId>
```

Per-user serialization (today's invariant from the in-process per-user `PQueue` in `src/lib/automation/browser-pool.ts`) moves to a Redis distributed lock keyed by `userId`. Pattern: `SET user-lock:<userId> <random-token> NX EX <ttl>`; release via Lua `EVAL` that does `GET-then-DEL` only if the stored token matches. This prevents two workers from running ARCA jobs for the same user in parallel (which would clobber each other's browser contexts and cookies).

If a worker fails to acquire the lock (another worker is already busy with that user), it re-publishes the `jobId` to the tail of the queue with a small back-off so a different worker — or the same one later — picks it up. This keeps the simple FIFO list semantics and avoids per-user queues, at the cost of occasional re-pushes during contention; given the small scale and serialized-per-user nature of the workload, that's acceptable.

### Failure recovery

If a worker dies hard (kernel OOM, host loss) mid-job, the `AutomationJob` row stays in `RUNNING` and the user-lock TTL eventually expires. The new `/api/cron/sweep-stuck-jobs` Vercel Cron periodically marks rows in `RUNNING` whose `currentStepStartedAt` hasn't advanced in N minutes as `FAILED`, freeing the user from a stuck UI state. This replaces the implicit "the worker process is healthy" assumption that's true with one Fly machine but not with a heterogeneous worker pool.

### Self-hostability

The worker must work cleanly on any Linux host with Docker. Avoid Fly-specific assumptions in `worker/`:

- No reliance on Fly's private networking (`*.flycast`, `*.internal`) — connect to Supabase and Redis via their public TLS endpoints
- No Fly-specific env vars (`FLY_APP_NAME`, `FLY_REGION`) referenced in code paths; if used for diagnostics, gate them behind `if (process.env.FLY_APP_NAME)`
- No reliance on Fly's auto-deploy or auto-stop semantics — workers idle cheaply (BRPOP blocks; no CPU cost) so always-on is fine
- Image runs the same on any container platform; the only host-specific things (health check endpoint format, deploy command) live in `fly.toml`, not in the worker code

### Supabase Prisma quirks

- Use the **transaction-mode pooler** (port 6543) for `DATABASE_URL`. Prisma works with it as long as we don't use prepared statements — the `PrismaPg` adapter (already in use) handles this correctly.
- `DIRECT_URL` (port 5432) is required for `prisma migrate deploy` and `prisma db push` because pooler doesn't support DDL inside a session.
- Supabase enforces SSL — connection strings include `?sslmode=require`.

### Drop SSE logs

The current SSE log stream is a debug aid that's been quietly orphaned — the user-facing UI shows step-based progress (`StepProgress` component) sourced from DB-persisted `currentStep`, not from streamed log lines. The only remaining `EventSource` consumer is `src/components/perfil/employers-section.tsx`, which can switch to the same polling pattern used by `useArcaImportProgress`. Removing the stream simplifies the worker (no need to expose a long-lived response stream from Fly back through QStash) and removes the in-memory state that wouldn't survive the split anyway.

### File storage migration

Today, `Invoice.fileData` and `DomesticReceipt.fileData` are `Bytes` columns. On Supabase free tier (500MB DB) this fills up fast. Move blobs to Supabase Storage:

- Bucket: `comprobantes`, private (no public reads); access via service-role key from the API routes only.
- Object path: `<userId>/<recordId>.<ext>`. The path is stored in `fileStorageKey`.
- `/api/comprobantes/[id]/file` and `/api/recibos/[id]/file` continue to enforce auth, then either redirect to a short-lived signed URL or proxy the byte stream from Storage.
- A one-shot script (run during the cutover window, after `pg_restore`) walks every row with `fileData != null`, uploads, writes `fileStorageKey`, and is safe to re-run (skip rows that already have `fileStorageKey`).
- The `fileData` and `fileMimeType` columns are NOT dropped in this spec — they're left in place as a safety net. A follow-up Prisma migration drops them once we've verified everything works.

### Cron strategy

- Use `vercel.json` `crons` for the three current daily jobs plus the new stuck-job sweeper. All three existing endpoints already accept POST with `x-cron-secret`. Vercel Cron's UA is documented but auth via the existing header continues to work.
- If the Vercel plan caps cron count below 4, the lowest-impact one (`review-non-deductible`) stays on a GitHub Actions schedule as a fallback.
- The stuck-job sweeper is intentionally a Vercel Cron (not a worker-side timer) so it works correctly even if the worker pool is empty or all workers are unreachable.

### Fly worker config

- VM: keep `shared-cpu-2x` 2GB (current). Playwright's footprint hasn't changed.
- Worker is a non-HTTP process — it pulls from Redis. If Fly insists on an HTTP health check for the machine type we use, expose a minimal `GET /health` on a private port; otherwise omit `[http_service]` entirely.
- `min_machines_running`: keep 1. Fly's auto-stop is HTTP-traffic-driven and doesn't help here (no inbound traffic). A blocked `BRPOP` is essentially free; always-on is the right default.
- Scaling on Fly: `fly scale count N` brings up additional worker machines. They'll all share the queue and the per-user lock invariant — no extra work required.

### Files most likely to change

- `prisma/schema.prisma` — add `directUrl`, add `fileStorageKey`
- `src/lib/prisma.ts` — verify pooler compatibility (likely no change)
- `src/lib/automation/job-processor.ts` — strip in-memory log Maps + exports
- `src/lib/automation/browser-pool.ts` — keep the in-process per-user `PQueue` (still useful within a single worker process), but the cross-worker invariant is now enforced by the Redis user-lock at the queue-loop level
- `src/app/api/automatizacion/route.ts` and other API routes that call `after(processJob)` — replace with `publishJob`
- `src/app/api/automatizacion/[jobId]/logs/route.ts` — delete
- `src/app/api/comprobantes/upload/route.ts`, `src/app/api/comprobantes/[id]/file/route.ts`, plus the recibos equivalents — Storage read/write
- `src/components/perfil/employers-section.tsx` — replace `EventSource` with polling
- New: `worker/index.ts`, `worker/Dockerfile`, `worker/README.md` (self-host runbook), `src/lib/queue/redis-queue.ts`, `src/app/api/cron/sweep-stuck-jobs/route.ts`, `vercel.json`, `scripts/migrate-files-to-supabase.mjs`
- Removed: `Dockerfile` (root), `.github/workflows/cron-*.yml` (3 files), possibly `.github/workflows/deploy.yml`
- Updated: `fly.toml`, `CLAUDE.md` (deployment + env vars sections + worker scaling notes)

## Out of Scope

- Dropping the legacy `fileData` / `fileMimeType` columns from Postgres — handled by a follow-up migration after the new Storage flow has soaked
- Automatic worker autoscaling based on queue depth (e.g. KEDA, Fly's Machines API auto-scale) — operators add/remove workers manually for now
- Priority queues, per-user fairness across workers, or starvation-avoidance beyond simple back-off-and-retry
- Migrating from Redis lists to Redis Streams + consumer groups (would give cleaner at-least-once semantics with `XACK` and `XCLAIM`, but the list+lock+sweeper approach is sufficient at current scale)
- Replacing Cloudflare with Vercel's edge entirely (Cloudflare keeps doing DDoS + DNS)
- Migrating the AI support chat (Ganancio) message storage to anything other than Postgres
- Observability (Sentry, Grafana, structured logs) — separate effort
- Switching Supabase from free to Pro tier — explicit decision deferred; the 7-day inactivity pause is accepted for now
- Replacing NextAuth with Supabase Auth — keep NextAuth + Prisma adapter
- Changing any business logic, tax math, ARCA selectors, or UI behavior beyond removing SSE log streaming
- Performance tuning the worker beyond what already exists (browser pool, p-queue concurrency)
