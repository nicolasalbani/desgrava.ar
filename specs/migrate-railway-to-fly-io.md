---
title: Migrate from Railway to Fly.io
status: implemented
priority: high
---

## Summary

Migrate the entire desgrava.ar application from Railway to Fly.io to achieve lower latency for Argentine users by deploying to the `gru` (São Paulo) region. This includes migrating the Next.js app server, PostgreSQL database, cron jobs (to GitHub Actions scheduled workflows), CI/CD pipeline, and DNS configuration via Cloudflare. A brief maintenance window is acceptable for the cutover.

## Acceptance Criteria

- [ ] `fly.toml` created with `gru` as primary region, health check, auto-stop/start config, and appropriate VM sizing (Playwright+Chromium needs ≥1GB RAM)
- [ ] Fly.io Postgres cluster provisioned in `gru` region
- [ ] Data migrated from Railway Postgres to Fly Postgres using `pg_dump`/`pg_restore`
- [ ] All production secrets set via `fly secrets set` (DATABASE_URL, ENCRYPTION_KEY, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, OPENAI_API_KEY, RESEND_API_KEY, CRON_SECRET, MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, SUPPORT_EMAIL, SUPPORT_WHATSAPP, NEXTAUTH_URL)
- [ ] Dockerfile updated if needed for Fly.io compatibility (port config, health check endpoint)
- [ ] GitHub Actions CI workflow extended with a `deploy` job that runs `fly deploy` on push to `main` (after lint, build, test pass)
- [ ] Two GitHub Actions scheduled workflows created to replace Railway cron:
  - `cron-presentaciones.yml` — daily POST to `/api/cron/presentaciones` with `x-cron-secret` header
  - `cron-subscription-reminders.yml` — daily POST to `/api/cron/subscription-reminders` with `x-cron-secret` header
- [ ] Cloudflare DNS updated: A/AAAA or CNAME records pointing `desgrava.ar` to the Fly.io app
- [ ] Fly.io TLS certificate provisioned for `desgrava.ar`
- [ ] MercadoPago webhook URL updated to new deployment if domain stays the same (no change needed)
- [ ] Google OAuth redirect URIs verified (no change needed if domain stays the same)
- [ ] `railway.json` removed from the repository
- [ ] `PROD_DATABASE_URL` and `PROD_API_URL` env vars updated in any environments that reference them (e.g., fix-ticket agent)
- [ ] Application accessible at `desgrava.ar` with all features working: auth, invoice upload/OCR, AI classification, ARCA automation, subscriptions, cron jobs
- [ ] `scripts/check-db.mjs` updated to recognize Fly.io database URLs as remote (skip local PG setup)

## Technical Notes

- **VM sizing**: The app runs Playwright with Chromium for ARCA/SiRADIG automation. This requires at minimum a `shared-cpu-2x` with 1GB RAM, though `performance-1x` (dedicated CPU, 2GB RAM) is recommended for reliable browser automation. Monitor memory usage post-migration.
- **Fly Postgres**: Use `fly postgres create --region gru`. This creates a managed Postgres cluster. The internal connection string uses Fly's private networking (`*.flycast` or `*.internal`). Set `DATABASE_URL` to the internal URL for low-latency DB access.
- **Data migration**: During the maintenance window: (1) stop Railway app, (2) `pg_dump` from Railway, (3) `pg_restore` to Fly Postgres, (4) `fly deploy`, (5) update Cloudflare DNS. The `prisma db push` in the Dockerfile CMD handles schema sync on startup.
- **Dockerfile changes**: Fly.io defaults to port 8080 but can be configured in `fly.toml`. Keep the existing `${PORT:-3000}` pattern and set `internal_port = 3000` in `fly.toml`, or let Fly set `PORT=8080` and rely on the existing `${PORT:-3000}` fallback. Either works — just be consistent.
- **Health check**: Add a lightweight `/api/health` endpoint (return 200) for Fly.io's HTTP health checks. Reference it in `fly.toml` under `[http_service.checks]`.
- **CI/CD deploy job**: Use `superfly/flyctl-actions/setup-flyctl@master` action + `fly deploy`. Requires `FLY_API_TOKEN` stored as a GitHub Actions secret. Only trigger deploy on push to `main` (not on PRs).
- **Cron via GitHub Actions**: Create two `.github/workflows/cron-*.yml` files using `schedule` trigger with cron expressions. Each workflow uses `curl` to POST to the production endpoint with the `x-cron-secret` header. Store `CRON_SECRET` and `PROD_API_URL` as GitHub Actions secrets.
- **Cloudflare DNS**: Since the domain is on Cloudflare, add a CNAME record pointing to `<app-name>.fly.dev`. Keep Cloudflare proxy (orange cloud) enabled for DDoS protection. Fly.io will still terminate TLS via its own cert — Cloudflare should be set to "Full (strict)" SSL mode.
- **`check-db.mjs`**: Currently checks for `railway` in DATABASE_URL to skip local setup. Add `fly` or `.internal` to the remote detection pattern.
- **Rollback plan**: Keep Railway app and database intact for 1 week after successful migration. If issues arise, revert Cloudflare DNS back to Railway's domain.

## Out of Scope

- Multi-region deployment or read replicas (single `gru` region is sufficient for now)
- Migrating to a different database provider (Supabase, Neon, etc.) — using Fly Postgres
- Changing the application code, business logic, or database schema
- Setting up Fly.io Machines API for auto-scaling or scheduled machines
- Blue-green or canary deployment strategies (simple rolling deploy is fine)
- Monitoring/observability setup beyond basic health checks (Grafana, Sentry, etc.)
