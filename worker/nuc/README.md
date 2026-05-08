# Self-hosted NUC worker

Runs a `desgrava-worker` container on an Intel NUC (or any Linux box with Docker)
alongside the Fly.io worker. Both compete for the same Redis queue and share
the same image, so capacity scales by adding hosts.

The stack is four containers:

| Container         | Image                                    | Purpose                                          | Watchtower-managed |
| ----------------- | ---------------------------------------- | ------------------------------------------------ | ------------------ |
| `desgrava-worker` | `ghcr.io/<owner>/desgrava-worker:latest` | Pulls jobs from Redis, runs Playwright           | yes                |
| `watchtower`      | `nickfedor/watchtower:latest`            | Polls GHCR every 5 min, replaces images in place | yes (self)         |
| `portainer`       | `portainer/portainer-ce:latest`          | Browser UI for logs, restarts, image inspection  | yes                |
| `cloudflared`     | `cloudflare/cloudflared:latest`          | Tunnel for `worker.desgrava.ar` + `ssh.worker.…` | yes                |

No inbound ports are opened on the NUC. Portainer binds only to `127.0.0.1:9000`;
remote access is via Cloudflare Tunnel, gated by Cloudflare Access (Google SSO).

## Prerequisites

- Linux NUC reachable as `ssh nuc` (i.e. existing entry in `~/.ssh/config`)
- Docker Engine installed (rootful, with `systemd` integration so `--restart unless-stopped` survives reboots)
- Clock synced via `systemd-timesyncd` or `chrony`
- A Cloudflare account that already manages `desgrava.ar` DNS
- The `cloudflared` CLI installed locally on a machine where you can `cloudflared login` (your Mac is fine — `~/.cloudflared/cert.pem` already exists)
- The GHCR package `ghcr.io/<owner>/desgrava-worker` is **public** (anonymous `docker pull` works without `docker login`)

## One-time setup

### 1. Cloudflare Tunnel and DNS

On a machine with `cloudflared` and an active Cloudflare cert:

```bash
# Create the tunnel — prints a UUID and writes <uuid>.json to ~/.cloudflared/
cloudflared tunnel create desgrava-nuc

# Route both hostnames to the new tunnel (creates orange-cloud CNAMEs in Cloudflare DNS)
cloudflared tunnel route dns desgrava-nuc worker.desgrava.ar
cloudflared tunnel route dns desgrava-nuc worker-ssh.desgrava.ar
```

### 2. Cloudflare Access

In the Cloudflare dashboard, under **Zero Trust → Access → Applications**, create two self-hosted applications:

- **Application 1** — domain `worker.desgrava.ar`, policy: `Allow` with `Emails` rule containing the operator's Google address
- **Application 2** — domain `worker-ssh.desgrava.ar`, same policy. Set **Protocol** to `SSH`.

Use Google as the identity provider. Confirm SSO works by visiting `https://worker.desgrava.ar` from a browser before going further — without Access in front, the next step exposes Portainer's bootstrap window to the public internet.

### 3. Copy credentials and config to the NUC

From the machine that ran `cloudflared tunnel create`:

```bash
# Copy the credentials JSON
ssh nuc 'sudo mkdir -p /etc/desgrava/cloudflared && sudo chmod 700 /etc/desgrava/cloudflared'
scp ~/.cloudflared/<tunnel-uuid>.json nuc:/tmp/
ssh nuc 'sudo mv /tmp/<tunnel-uuid>.json /etc/desgrava/cloudflared/ && sudo chmod 600 /etc/desgrava/cloudflared/<tunnel-uuid>.json && sudo chown -R root:root /etc/desgrava/cloudflared'

# Copy the config template and edit <tunnel-id> to match
scp worker/nuc/cloudflared.config.example.yml nuc:/tmp/config.yml
ssh nuc 'sudo mv /tmp/config.yml /etc/desgrava/cloudflared/config.yml && sudo chown root:root /etc/desgrava/cloudflared/config.yml'
ssh nuc 'sudo nano /etc/desgrava/cloudflared/config.yml'   # replace <tunnel-id> in two places
```

### 4. Worker env file

```bash
ssh nuc 'sudo mkdir -p /etc/desgrava && sudo touch /etc/desgrava/worker.env && sudo chmod 600 /etc/desgrava/worker.env && sudo chown root:root /etc/desgrava/worker.env'
ssh nuc 'sudo nano /etc/desgrava/worker.env'
```

Required keys (mirror what Fly already has):

```
REDIS_URL=...
DATABASE_URL=...
DIRECT_URL=...
ENCRYPTION_KEY=...
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
WORKER_ID=nuc-1
WORKER_CONCURRENCY=10
```

## Install

Copy `worker/nuc/install.sh` to the NUC and run it as root:

```bash
scp worker/nuc/install.sh nuc:/tmp/
ssh nuc 'sudo WORKER_ENV_FILE=/etc/desgrava/worker.env GHCR_OWNER=<owner> CLOUDFLARED_DIR=/etc/desgrava/cloudflared bash /tmp/install.sh'
```

The script is idempotent — re-run it any time to refresh the four containers from the latest images.

## First-boot Portainer admin password

Portainer's "set admin password" form is reachable for **only 5 minutes** after the first start. Set it immediately:

- Recommended: `ssh -L 9000:127.0.0.1:9000 nuc` and open `http://localhost:9000` in a browser. This avoids any risk of the bootstrap window leaking through Cloudflare Access while Access is still being configured.
- After the password is set, future logins go through `https://worker.desgrava.ar` (Access SSO → Portainer login).

If the 5-minute window closes without a password being set, restart Portainer to reopen it: `ssh nuc sudo docker restart portainer`.

## Update local `~/.ssh/config`

Replace the existing `nuc` entry on your Mac with the cloudflared form:

```
Host nuc
  HostName worker-ssh.desgrava.ar
  ProxyCommand cloudflared access ssh --hostname %h
  User <username>
```

First connection from each device will trigger Google SSO via `cloudflared`; subsequent connections reuse a short-lived token cached in `~/.cloudflared/`.

## Why cloudflared runs as `--user 0:0`

`cloudflare/cloudflared:latest` ships with a `nonroot` (uid 65532) default user, which can't read the credentials JSON or `config.yml` under `/etc/desgrava/cloudflared` (mode 600/700 root:root per spec). `install.sh` runs the container as root explicitly. The bind mount is `:ro` so root inside the container still can't modify host files — the only thing root buys here is read access to the config and credentials.

## Verify

```bash
# Containers up
ssh nuc sudo docker ps

# Worker is consuming jobs (look for the [worker:nuc-1] startup line)
ssh nuc sudo docker logs --tail 30 desgrava-worker

# Tunnel is connected (look for "Registered tunnel connection" lines)
ssh nuc sudo docker logs --tail 30 cloudflared

# Portainer reachable through the tunnel (after SSO)
open https://worker.desgrava.ar
```

In the dashboard, jobs picked up by the NUC will have log lines prefixed with
`[worker:nuc-1]` (vs the Fly machine's auto-generated hostname).

## Auto-update flow

Watchtower polls GHCR every 5 minutes for any image whose container has the
`com.centurylinklabs.watchtower.enable=true` label. When a new digest is found:

1. `docker pull` the new image
2. `docker stop --time 30 <container>` — sends `SIGTERM`, waits up to 30 s for the worker to drain in-flight jobs (per `worker/index.ts`'s shutdown handler)
3. `docker rm` the old container, `docker run` the new one with the same args
4. `docker image rm` the old image (`--cleanup`)

Watchtower itself carries the same label, so it self-updates. Manual force-update:

```bash
ssh nuc 'sudo docker exec watchtower /watchtower --run-once --label-enable --cleanup'
```

## Manual rollback

If a bad deploy lands and the auto-update breaks the worker, pin to a known-good
SHA tag (Watchtower won't bump non-`:latest` tags):

```bash
ssh nuc 'sudo docker rm -f desgrava-worker'
ssh nuc 'sudo docker run -d \
  --name desgrava-worker \
  --restart unless-stopped \
  --env-file /etc/desgrava/worker.env \
  --stop-timeout 30 \
  ghcr.io/<owner>/desgrava-worker:<known-good-sha>'
```

To resume auto-updates afterwards, switch back to `:latest` (re-add the
Watchtower label or just re-run `install.sh`).

## Logs

- Browser: `https://worker.desgrava.ar` → container → Logs
- CLI: `ssh nuc sudo docker logs -f <container>`
- journald: `ssh nuc sudo journalctl -u docker CONTAINER_NAME=desgrava-worker -f`

## Uninstall

```bash
scp worker/nuc/uninstall.sh nuc:/tmp/
ssh nuc 'sudo bash /tmp/uninstall.sh'              # stop+remove containers
ssh nuc 'sudo bash /tmp/uninstall.sh --purge'      # also drop images + portainer_data volume
```

Neither variant touches `/etc/desgrava/*` — env file and tunnel credentials
remain in place, so a re-install is just `install.sh` again.

## Env-var rotation

When a secret rotates (e.g. `ENCRYPTION_KEY`, MercadoPago, Supabase service
role), update **all three** hosts:

1. Vercel env vars
2. `fly secrets set …`
3. `/etc/desgrava/worker.env` on the NUC, then `ssh nuc sudo docker restart desgrava-worker`

Watchtower does not redeploy on env-file changes — it only redeploys on image
changes — so the manual restart is required.

## Why this topology

- **Watchtower over GHA SSH push**: keeps the NUC behind NAT with zero open ports. Adding a worker stays a "config + `docker run`" exercise per the project-wide invariant.
- **Cloudflare Tunnel over Tailscale**: leverages the Cloudflare account already managing `desgrava.ar` DNS and gives Access SSO at the edge for free, vs. requiring a Tailscale client install on every device that needs to reach the NUC.
- **Two subdomains for SSH and Portainer**: Cloudflare Tunnel ingress dispatches by hostname; one hostname can only map to one backend service. See `specs/self-hosted-nuc-worker-with-auto-update.md` for the platform-constraint details.
