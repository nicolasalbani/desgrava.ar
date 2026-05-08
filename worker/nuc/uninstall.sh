#!/usr/bin/env bash
# Tear down the desgrava.ar NUC worker stack.
#
# Default behavior: stops and removes the four containers.
# With --purge: also removes the four images and the portainer_data volume.
# Never touches /etc/desgrava/* (env file, cloudflared credentials, config.yml).

set -euo pipefail

PURGE=0
if [[ "${1:-}" == "--purge" ]]; then
  PURGE=1
fi

remove_if_exists() {
  local name="$1"
  if docker inspect "$name" >/dev/null 2>&1; then
    echo "==> removing $name"
    docker rm -f "$name" >/dev/null
  fi
}

remove_if_exists desgrava-worker
remove_if_exists watchtower
remove_if_exists portainer
remove_if_exists cloudflared

if [[ $PURGE -eq 1 ]]; then
  echo "==> --purge: removing images and portainer_data volume"
  docker image rm \
    "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^(ghcr.io/.*/desgrava-worker|nickfedor/watchtower|portainer/portainer-ce|cloudflare/cloudflared):' || true)" \
    2>/dev/null || true
  docker volume rm portainer_data >/dev/null 2>&1 || true
fi

echo "Done."
