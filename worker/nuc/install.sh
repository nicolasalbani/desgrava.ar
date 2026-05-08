#!/usr/bin/env bash
# Idempotent installer for the desgrava.ar worker on a self-hosted NUC.
# Brings up four containers — worker, watchtower, portainer, cloudflared —
# all auto-restarting and (where opted in) auto-updating via Watchtower.
#
# Required env vars:
#   WORKER_ENV_FILE  — path to the worker .env (e.g. /etc/desgrava/worker.env)
#   GHCR_OWNER       — GitHub owner/org that publishes ghcr.io/<owner>/desgrava-worker
#   CLOUDFLARED_DIR  — directory holding config.yml and the tunnel credentials JSON
#                      (e.g. /etc/desgrava/cloudflared)
#
# Re-running this script is safe: existing containers are removed and recreated
# from the latest images. Volumes (portainer_data) and the env/credentials
# files on the host are preserved.

set -euo pipefail

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: $name is required" >&2
    exit 1
  fi
}

require_var WORKER_ENV_FILE
require_var GHCR_OWNER

SKIP_CLOUDFLARED="${SKIP_CLOUDFLARED:-0}"
if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  require_var CLOUDFLARED_DIR
fi

if [[ ! -f "$WORKER_ENV_FILE" ]]; then
  echo "ERROR: WORKER_ENV_FILE does not exist: $WORKER_ENV_FILE" >&2
  exit 1
fi

if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  if [[ ! -d "$CLOUDFLARED_DIR" ]]; then
    echo "ERROR: CLOUDFLARED_DIR does not exist: $CLOUDFLARED_DIR" >&2
    exit 1
  fi

  if [[ ! -f "$CLOUDFLARED_DIR/config.yml" ]]; then
    echo "ERROR: $CLOUDFLARED_DIR/config.yml is missing." >&2
    echo "Copy worker/nuc/cloudflared.config.example.yml and edit the tunnel id + credentials path." >&2
    exit 1
  fi

  if ! ls "$CLOUDFLARED_DIR"/*.json >/dev/null 2>&1; then
    echo "ERROR: no tunnel credentials JSON found in $CLOUDFLARED_DIR" >&2
    echo "Run 'cloudflared tunnel create desgrava-nuc' on a Cloudflare-authenticated machine and copy the resulting <tunnel-id>.json into $CLOUDFLARED_DIR." >&2
    exit 1
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed" >&2
  exit 1
fi

GHCR_OWNER_LC="$(echo "$GHCR_OWNER" | tr '[:upper:]' '[:lower:]')"
WORKER_IMAGE="ghcr.io/${GHCR_OWNER_LC}/desgrava-worker:latest"
WATCHTOWER_IMAGE="nickfedor/watchtower:latest"
PORTAINER_IMAGE="portainer/portainer-ce:latest"
CLOUDFLARED_IMAGE="cloudflare/cloudflared:latest"

WATCHTOWER_LABEL="com.centurylinklabs.watchtower.enable=true"

echo "==> Pulling images"
docker pull "$WORKER_IMAGE"
docker pull "$WATCHTOWER_IMAGE"
docker pull "$PORTAINER_IMAGE"
if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  docker pull "$CLOUDFLARED_IMAGE"
fi

echo "==> Ensuring portainer_data volume exists"
docker volume create portainer_data >/dev/null

remove_if_exists() {
  local name="$1"
  if docker inspect "$name" >/dev/null 2>&1; then
    echo "    removing existing $name"
    docker rm -f "$name" >/dev/null
  fi
}

echo "==> (Re)creating containers"
remove_if_exists desgrava-worker
remove_if_exists watchtower
remove_if_exists portainer
if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  remove_if_exists cloudflared
fi

docker run -d \
  --name desgrava-worker \
  --restart unless-stopped \
  --env-file "$WORKER_ENV_FILE" \
  --stop-timeout 30 \
  --label "$WATCHTOWER_LABEL" \
  "$WORKER_IMAGE" >/dev/null
echo "    started desgrava-worker"

docker run -d \
  --name portainer \
  --restart unless-stopped \
  -p 127.0.0.1:9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  --label "$WATCHTOWER_LABEL" \
  "$PORTAINER_IMAGE" >/dev/null
echo "    started portainer (bound to 127.0.0.1:9000)"

if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  # --user 0:0 because cloudflared:latest defaults to uid 65532 and can't read
  # the credentials JSON or config.yml under /etc/desgrava/cloudflared (mode 600/700 root:root).
  # The mount is read-only so this doesn't grant write access to host paths.
  docker run -d \
    --name cloudflared \
    --restart unless-stopped \
    --network host \
    --user 0:0 \
    -v "$CLOUDFLARED_DIR:/etc/cloudflared:ro" \
    --label "$WATCHTOWER_LABEL" \
    "$CLOUDFLARED_IMAGE" \
    tunnel --config /etc/cloudflared/config.yml run >/dev/null
  echo "    started cloudflared (host network)"
else
  echo "    skipped cloudflared (SKIP_CLOUDFLARED=1)"
fi

docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --label "$WATCHTOWER_LABEL" \
  "$WATCHTOWER_IMAGE" \
  --label-enable \
  --cleanup \
  --interval 300 >/dev/null
echo "    started watchtower (polls every 300s)"

echo
if [[ "$SKIP_CLOUDFLARED" != "1" ]]; then
  echo "==> All four containers are up:"
else
  echo "==> Three containers are up (cloudflared skipped):"
fi
docker ps --filter "name=desgrava-worker" --filter "name=watchtower" --filter "name=portainer" --filter "name=cloudflared" \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

cat <<EOF

Verify:
  - Worker logs:        docker logs -f desgrava-worker
  - Portainer (local):  ssh -L 9000:127.0.0.1:9000 nuc  →  http://localhost:9000
  - Portainer (remote): https://worker.desgrava.ar  (after Cloudflare Access SSO)
  - SSH via tunnel:     ssh nuc  (with cloudflared access ssh ProxyCommand)
EOF
