# desgrava.ar worker

A long-running Node process that pulls automation jobs from a Redis queue and
runs Playwright against ARCA / SiRADIG. The Vercel-hosted Next.js app enqueues
jobs; one or more workers consume them.

The worker is deliberately platform-agnostic. The same Docker image runs on
Fly.io, on a self-hosted Linux box via `docker run`, on Kubernetes, on ECS, or
inside Docker Compose. It does **not** expose a public HTTP port — workers pull
from the queue. They need only outbound network access to Redis and Postgres.

## Required environment variables

| Var                         | Required | Purpose                                                                                    |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `REDIS_URL`                 | yes      | The same Redis instance the Vercel app publishes to. Upstash, Fly Redis, self-hosted, …    |
| `DATABASE_URL`              | yes      | Pooled Postgres connection string (Supabase pooler port 6543).                             |
| `DIRECT_URL`                | yes      | Direct Postgres connection string (Supabase port 5432) — required by Prisma migrations.    |
| `ENCRYPTION_KEY`            | yes      | 64-char hex AES-256-GCM key for decrypting ARCA credentials at job execution time.         |
| `OPENAI_API_KEY`            | yes      | Used by `PULL_COMPROBANTES` for AI invoice category classification.                        |
| `SUPABASE_URL`              | yes      | Supabase project URL — the worker uploads `Presentacion` and `DomesticReceipt` PDFs.       |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Service-role key for Storage uploads. Treat as a private key — never log or commit.        |
| `TELEGRAM_BOT_TOKEN`        | optional | If set, worker emits the same Telegram notifications the app does.                         |
| `TELEGRAM_CHAT_ID`          | optional | Chat ID for Telegram notifications.                                                        |
| `WORKER_ID`                 | optional | Stable identifier prefixed in log lines. Defaults to `os.hostname()`.                      |
| `WORKER_CONCURRENCY`        | optional | Max in-flight jobs per worker process. Default `10` (matches the in-process browser pool). |

## Running locally

```bash
npm install
REDIS_URL=redis://localhost:6379 \
DATABASE_URL=... DIRECT_URL=... ENCRYPTION_KEY=... OPENAI_API_KEY=... \
npx tsx worker/index.ts
```

The worker logs a startup line including `WORKER_ID` so you can tell which
worker picked up which job in the DB logs:

```
[worker:my-laptop.local] started — concurrency=10, brpop_timeout=5s
```

## Running via Docker

Build the image:

```bash
docker build -f worker/Dockerfile -t desgrava-worker .
```

Run a single worker:

```bash
docker run --rm \
  -e REDIS_URL=$REDIS_URL \
  -e DATABASE_URL=$DATABASE_URL \
  -e DIRECT_URL=$DIRECT_URL \
  -e ENCRYPTION_KEY=$ENCRYPTION_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e WORKER_ID=worker-1 \
  desgrava-worker
```

Add a second worker on a different host with the same env vars and a different
`WORKER_ID`. Both will compete for the same queue. Per-user serialization is
preserved across workers via a Redis distributed lock — no two workers will
ever run a job for the same user in parallel, even when they're on different
machines.

## Scaling

- **More throughput, same host**: bump `WORKER_CONCURRENCY` up to ~10. The
  bottleneck above that is Chromium memory (~150–250 MB per browser context).
- **More throughput, more hosts**: bring up additional workers anywhere with
  the same env vars. They'll compete for the queue. There's no coordination
  needed — adding a worker is purely an env-vars-and-`docker run` operation.
- **Removing a worker**: send `SIGTERM` (or `docker stop`). The worker stops
  accepting new jobs, drains in-flight work for up to 30s, then exits. Any job
  it can't finish in time stays in `RUNNING` until the stuck-job sweeper marks
  it `FAILED` (Vercel cron, every 5 min).

## Health / observability

The worker doesn't bind a port. Use process-level health (`docker ps`,
`systemctl status`, k8s liveness on the process) rather than HTTP probes. Logs
go to stdout in plain text — pipe them to your aggregator of choice.

## How it differs from the old Fly Next.js process

- No HTTP server. No `next start`. No public URL.
- Reads jobs via Redis `BRPOP` instead of in-process `after()` callbacks.
- Acquires a Redis distributed lock keyed by `userId` before running a job, so
  multiple workers can run safely in parallel.
- A heartbeat extends the lock every minute while the job is in flight; if the
  worker dies hard, the lock expires after 15 minutes and another worker can
  pick up replays. The Vercel `sweep-stuck-jobs` cron then marks the original
  row `FAILED`.
