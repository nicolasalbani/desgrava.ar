---
title: Self-hosted NUC worker with auto-update
status: implemented
priority: medium
---

## Summary

Bring up a self-hosted Playwright worker on the home NUC (reachable as `ssh nuc`) so it competes with the Fly.io worker pool against the same Redis queue, adding extra capacity at zero marginal cloud cost. The worker auto-updates whenever the worker image changes on `main`, mirroring the Fly deploy flow: GitHub Actions already pushes `ghcr.io/<owner>/desgrava-worker:latest` on every push, so a Watchtower container on the NUC polls GHCR every few minutes, pulls the new image, gracefully drains and restarts the worker container. A Portainer CE container runs alongside the worker so logs, container state, image digests, and restarts can be inspected and triggered from a browser. Both Portainer and SSH are exposed off-network via a Cloudflare Tunnel (`cloudflared`) under `worker.desgrava.ar`, gated by Cloudflare Access — so the NUC keeps zero open inbound ports while still being reachable from anywhere. The NUC only needs outbound network to GHCR, Redis, Postgres, Supabase, OpenAI, Telegram, and Cloudflare's edge.

## Acceptance Criteria

### Host setup (one-time)

- [ ] Docker Engine installed on the NUC (rootful, with `systemd` integration so it survives reboots)
- [ ] `/etc/desgrava/worker.env` created with `chmod 600` / `root:root` containing every required worker env var: `REDIS_URL`, `DATABASE_URL`, `DIRECT_URL`, `ENCRYPTION_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus optional `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WORKER_ID=nuc-1`, `WORKER_CONCURRENCY` (default 10)
- [ ] GHCR package `ghcr.io/<owner>/desgrava-worker` confirmed public (anonymous `docker pull` works from the NUC; no `docker login` needed)
- [ ] NUC clock synced via `systemd-timesyncd` or `chrony` (Playwright + signed Supabase URLs are clock-sensitive)

### Worker container

- [ ] `desgrava-worker` container running on the NUC from `ghcr.io/<owner>/desgrava-worker:latest`
- [ ] Container runs with `--restart unless-stopped`, `--env-file /etc/desgrava/worker.env`, `--name desgrava-worker`, and a Docker label that opts it in to Watchtower management (`com.centurylinklabs.watchtower.enable=true`)
- [ ] Container's stop grace period is at least 30 seconds (`--stop-timeout 30`) so the worker's `SIGTERM` handler can drain in-flight jobs as documented in `worker/README.md`
- [ ] Logs go to `journald` via Docker's default driver and are viewable with `journalctl -u docker CONTAINER_NAME=desgrava-worker -f`
- [ ] On startup, the worker logs `[worker:nuc-1] started — concurrency=…, brpop_timeout=…` and begins consuming jobs from the same Redis queue Fly is consuming

### Auto-update via Watchtower

- [ ] A second container `watchtower` runs on the NUC from `nickfedor/watchtower:latest` (the maintained fork — `containrrr/watchtower` is archived and ships an API-1.25 Docker client that's incompatible with Docker 29.x daemons) with:
  - `/var/run/docker.sock` mounted read-only
  - `--label-enable` (only manage explicitly opted-in containers — never restart anything else on the NUC)
  - `--cleanup` (remove old images after restart)
  - `--interval 300` (poll every 5 minutes; matches typical CI build cadence and keeps GHCR pulls cheap)
  - `--include-restarting` disabled; `--rolling-restart` not needed (single container)
- [ ] Watchtower also runs with `--restart unless-stopped` so it survives reboots
- [ ] When a new `:latest` image hits GHCR, Watchtower (within 5 min): pulls, sends `SIGTERM` to the worker, waits up to the 30 s stop timeout for it to drain, replaces the container, and removes the old image
- [ ] Watchtower itself updates via the same mechanism (it self-manages — opt-in via the label) so it stays current

### Container management (Portainer)

- [ ] A `portainer` container runs on the NUC from `portainer/portainer-ce:latest` with:
  - `/var/run/docker.sock` mounted (read-write — Portainer needs to manage containers, not just read state)
  - A named volume `portainer_data` mounted at `/data` for the Portainer DB (admin user, settings, Edge Stacks)
  - `--restart unless-stopped` so it survives reboots
  - The Watchtower opt-in label (`com.centurylinklabs.watchtower.enable=true`) so it auto-updates with the rest
  - Bound only on `127.0.0.1:9000` (HTTP) — never on `0.0.0.0` — since exposure is via the Cloudflare Tunnel, not a published port. The internal HTTPS port (9443) is left disabled to avoid the self-signed-cert UX inside the tunnel.
- [ ] First-boot bootstrap: the runbook calls out the 5-minute window in which Portainer accepts an admin-password setup, and instructs the operator to set the admin password _immediately_ after the tunnel comes up (or, alternatively, to bootstrap over `localhost` via `ssh -L 9000:127.0.0.1:9000 nuc` before exposing the tunnel)
- [ ] Portainer is configured with the local Docker environment as its only endpoint — no Edge Agent setup, no remote endpoints
- [ ] Manual smoke test from a browser at `https://worker.desgrava.ar`: see both `desgrava-worker` and `watchtower` containers, view live logs from `desgrava-worker`, view image digest, trigger a manual restart and confirm the worker drains and comes back

### Cloudflare Tunnel exposure

- [ ] A `cloudflared` container runs on the NUC from `cloudflare/cloudflared:latest` with:
  - The tunnel credentials JSON mounted from `/etc/desgrava/cloudflared/` (read-only)
  - `--restart unless-stopped`
  - Watchtower opt-in label
  - Run as `tunnel run --config /etc/cloudflared/config.yml <tunnel-name>` (named tunnel; not the trial `cloudflared tunnel --url` flow)
- [ ] A Cloudflare Tunnel named `desgrava-nuc` is provisioned in the existing Cloudflare account (the same one already managing `desgrava.ar` DNS) and its credentials JSON lives at `/etc/desgrava/cloudflared/<tunnel-id>.json` (`chmod 600` / `root:root`)
- [ ] DNS records (CNAME → `<tunnel-id>.cfargotunnel.com`, proxied/orange-cloud) created for:
  - `worker.desgrava.ar` → routes to Portainer (`http://127.0.0.1:9000`)
  - `worker-ssh.desgrava.ar` → routes to SSH (`tcp://127.0.0.1:22`)
- [ ] `/etc/desgrava/cloudflared/config.yml` ingress rules configured exactly:
  ```yaml
  tunnel: <tunnel-id>
  credentials-file: /etc/cloudflared/<tunnel-id>.json
  ingress:
    - hostname: worker.desgrava.ar
      service: http://host.docker.internal:9000
    - hostname: worker-ssh.desgrava.ar
      service: ssh://host.docker.internal:22
    - service: http_status:404
  ```
  (Or `--network host` on the cloudflared container with `127.0.0.1` services — runbook picks one and sticks with it.)
- [ ] Cloudflare Access application gates **both** hostnames with a Google-SSO email allow-list of just the operator's email — Access is not optional, since it's the only thing standing between the public internet and an SSH/Portainer port
- [ ] SSH access from any client works via the documented one-line `~/.ssh/config` block:
  ```
  Host nuc
    HostName worker-ssh.desgrava.ar
    ProxyCommand cloudflared access ssh --hostname %h
    User <username>
  ```
  The existing `ssh nuc` shortcut on the developer's Mac is updated to use this form (replacing whatever LAN/Tailscale path it uses today)
- [ ] After cutover, no inbound ports are open on the NUC's network: `nmap` from outside the LAN against the NUC's public IP shows zero open ports
- [ ] Manual smoke test from off-LAN: browser → `https://worker.desgrava.ar` reaches Portainer through Access; `ssh nuc` reaches the NUC through Access; both prompt for Google SSO on first connection per device

### Survives reboots

- [ ] After `sudo reboot`, all four containers — `desgrava-worker`, `watchtower`, `portainer`, `cloudflared` — come back up automatically (verified with a manual reboot smoke test)
- [ ] No systemd unit files are required — `--restart unless-stopped` plus Docker's own `docker.service` enablement is enough

### Verification & runbook

- [ ] `worker/README.md` gains a "Self-hosted on a NUC" section documenting: prerequisites, the exact `docker run` commands for all four containers (worker + watchtower + portainer + cloudflared), the env file layout, the Cloudflare Tunnel + Access provisioning steps (one-time, manual), how to verify the worker is consuming, how to view logs (Portainer UI + `journalctl`), how to roll back manually (`docker pull <sha-tag>` + restart), and how to remove everything (`docker rm -f desgrava-worker watchtower portainer cloudflared`)
- [ ] One-shot install/uninstall helper at `worker/nuc/install.sh` + `worker/nuc/uninstall.sh` (idempotent bash) so re-bringing up the NUC is a single command — install requires `WORKER_ENV_FILE=/path/to/worker.env`, `GHCR_OWNER=<owner>`, and `CLOUDFLARED_DIR=/etc/desgrava/cloudflared` (with the tunnel credentials already present) to be set
- [ ] After install, manual smoke test: enqueue a low-cost job (e.g. `VALIDATE_CREDENTIALS`) and confirm that across enough runs both Fly and the NUC pick up jobs (visible in `AutomationJob.logs` via the `[worker:nuc-1]` vs Fly hostname prefix)
- [ ] Manual auto-update test: push a trivial worker change to `main`, wait for CI to publish the new `:latest`, confirm within 5–10 min that the NUC has restarted on the new image (`docker inspect desgrava-worker --format '{{.Image}}'` digest matches the new GHCR digest)
- [ ] `CLAUDE.md` "CI/CD & Deployment" section updated to mention that the NUC is a second worker host alongside Fly, sharing the same image and queue, and auto-updating via Watchtower

## Technical Notes

### Why Watchtower, not GHA SSH

The existing platform-agnostic worker philosophy (per `worker/README.md` and `vercel-supabase-redis-worker-pool-migration.md`) is that adding a worker should be "purely an env-vars-and-`docker run` operation, no inbound network access required". Watchtower preserves that — the NUC keeps zero open ports and works behind any NAT. An SSH-from-GHA approach would tie the NUC to a stable network path and add a GHA secret. The 5-minute polling delay vs Fly's near-instant deploy is acceptable for a worker that already takes 10–30 s to drain anyway.

### Image tagging

The existing `deploy-worker.yml` workflow already publishes both `:<sha>` and `:latest` tags. Watchtower watches `:latest`. The `:<sha>` tag stays available as the explicit rollback handle (`docker stop desgrava-worker && docker run … ghcr.io/.../desgrava-worker:<known-good-sha>`) — note that running a non-`:latest` tag means Watchtower won't auto-update it until you switch back, which is what we want during a rollback.

### Graceful drain on restart

`worker/index.ts` already handles `SIGTERM` by stopping `BRPOP`, draining in-flight jobs for up to 30 s, then exiting. Watchtower sends `SIGTERM` and waits for the container's configured `--stop-timeout` (30 s here) before forcing `SIGKILL`. Net effect: the new image only starts processing once the old one has finished its current jobs (or 30 s have elapsed, in which case the Vercel `sweep-stuck-jobs` cron will eventually mark any orphaned `RUNNING` rows as `FAILED` per existing behavior).

### No coordination needed with Fly

Per-user serialization is enforced by the Redis distributed lock in `src/lib/queue/redis-queue.ts` — Fly and the NUC will not run jobs for the same user in parallel, so they can be naively brought up in parallel with no extra config. The `WORKER_ID=nuc-1` env makes NUC log lines easy to grep in `AutomationJob.logs`.

### Env vars are user-managed

This spec does not introduce a secrets manager. The `.env` file is hand-managed: when a key rotates (e.g. `ENCRYPTION_KEY`, MercadoPago, Supabase service role), it has to be updated on Vercel, on Fly secrets, _and_ on the NUC's `/etc/desgrava/worker.env` followed by `docker restart desgrava-worker`. The runbook calls this out.

### Why Portainer (not just `docker logs` over SSH)

`docker logs -f` over SSH already works once the tunnel is up. Portainer adds: a one-screen overview of every container's image digest + uptime + health, one-click restart with confirm, exec-into-container shell from the browser, and image-update prompts that are useful as a sanity check on Watchtower's last poll. It also means non-technical observation (e.g. "is the worker running right now?") doesn't require an SSH client. We deliberately skip Portainer's Edge Agent / Edge Stacks features — this is a single-host install, the local socket binding is sufficient.

### Why Cloudflare Tunnel (not Tailscale, not port-forwarding)

The NUC sits behind a residential NAT. Three options to reach it from outside:

- **Port forwarding + dynamic DNS**: opens 22 and 9000 to the public internet. Either we then trust SSH key auth + Portainer's admin password to be the only thing between the world and the box (uncomfortable), or we layer on fail2ban, geo-blocking, etc. (bespoke, hard to keep current).
- **Tailscale**: clean and free, but requires every client device (laptop, phone, future ops contributor) to install a client. The user already has cloudflared set up (`~/.cloudflared/` exists with a cert and tunnel JSON), and Cloudflare Access is already a credible auth layer because we're already a Cloudflare customer for `desgrava.ar` DNS.
- **Cloudflare Tunnel + Access** (chosen): the NUC keeps zero open ports, every request hits Cloudflare's edge first, Access enforces Google SSO + email allow-list at the edge, and SSH-over-HTTPS is bridged by `cloudflared access ssh` on the client side (no native SSH port exposed anywhere). Symmetric with how the Vercel app sits behind Cloudflare for `desgrava.ar`.

The tradeoff is that `ssh nuc` now goes through `cloudflared access ssh` — a one-time `cloudflared` install on the developer's Mac (already done per the existing `~/.cloudflared/` directory) plus an SSO flow on first connection per device. Acceptable.

### Subdomain layout

- `worker.desgrava.ar` — Portainer UI (HTTP 9000 inside the NUC, HTTPS via Cloudflare's edge cert)
- `worker-ssh.desgrava.ar` — SSH (TCP 22 inside the NUC, tunneled as a TCP service through cloudflared, accessed via `cloudflared access ssh`)

Both DNS records are CNAMEs to `<tunnel-id>.cfargotunnel.com` with the orange cloud on; Cloudflare's edge handles TLS termination for the HTTP one and TCP-over-WebSocket forwarding for the SSH one.

**Why `worker-ssh.*` and not `ssh.worker.*`** — Cloudflare's Universal SSL covers the apex + a one-level wildcard (`desgrava.ar` and `*.desgrava.ar`), but TLS wildcards are non-recursive: `*.desgrava.ar` does **not** cover two-deep hostnames like `ssh.worker.desgrava.ar`. Two-deep coverage requires Advanced Certificate Manager ($10/mo) or Total TLS (which itself requires ACM). A flat hostname like `worker-ssh.desgrava.ar` keeps the visual grouping with `worker.desgrava.ar` while staying within the free wildcard, so we use that instead.

**Why two hostnames instead of `worker.desgrava.ar:22` for SSH** — this is a constraint of how Cloudflare Tunnel works, not a stylistic choice:

1. **Proxied DNS at Cloudflare's edge only accepts HTTP/HTTPS on a fixed port allowlist** (80, 443, plus a few like 2053/2083/2087/2096 for HTTPS, and 8443). Port 22 is not on that list, so traffic to `worker.desgrava.ar:22` would never reach Cloudflare's edge as proxied traffic — and a Tunnel has no public IP to gray-cloud it to either.
2. **`cloudflared access ssh` doesn't actually open a port-22 path.** It opens a WebSocket from the client to Cloudflare's edge on 443, Access authenticates the request, then Cloudflare forwards the byte stream through the Tunnel to whichever ingress rule matches the **hostname**. The `:22` in a URL is irrelevant to that flow.
3. **Tunnel ingress rules dispatch by hostname (+ optional path), not by port.** One hostname maps to exactly one backend service, so a single hostname cannot be both `http://...:9000` (Portainer) and `ssh://...:22` (SSH).

The two-hostname split is the documented Cloudflare pattern and matches every cloudflared-based SSH setup.

### Files most likely to change / add

- New: `worker/nuc/install.sh`, `worker/nuc/uninstall.sh`, `worker/nuc/README.md` (or extend `worker/README.md`), `worker/nuc/cloudflared.config.example.yml` (template for the operator to drop into `/etc/desgrava/cloudflared/config.yml`)
- Updated: `worker/README.md` (add the "Self-hosted on a NUC" section, including Portainer + cloudflared), `CLAUDE.md` ("CI/CD & Deployment" section)
- No changes to: `worker/Dockerfile`, `worker/index.ts`, `.github/workflows/deploy-worker.yml`, `fly.toml`, any application code (this is purely a deployment topology change)

## Out of Scope

- Replacing Fly with the NUC (this spec keeps both — Fly removal is a future decision)
- Secrets manager or automated env-var rotation on the NUC
- Tailscale, WireGuard, or any other VPN — Cloudflare Tunnel + Access is the only remote-access path
- Multiple NUC machines or Watchtower group orchestration (one NUC, one worker, one Watchtower)
- Portainer Edge Agent / Edge Stacks / multi-endpoint setups — single local Docker endpoint only
- Cloudflare Access service tokens or non-interactive auth (e.g. for CI to SSH in) — interactive Google SSO only
- Exposing any other service through the tunnel (e.g. cAdvisor, Prometheus, Grafana) — only Portainer + SSH
- Monitoring/alerting on NUC health (Sentry, Grafana, uptime checks) — rely on Portainer, `journalctl`, and the Vercel `sweep-stuck-jobs` cron for now
- Switching to Docker Compose / Kubernetes / podman — plain `docker run` is sufficient
- Replacing the `:latest` rolling tag with a more conservative pinning + manual promotion flow
- Hardware setup of the NUC itself (OS install, networking, SSH key distribution) — assumed already done since `ssh nuc` works
- Backups, disk monitoring, or wear-leveling for the NUC's storage
