#!/usr/bin/env bash
set -uo pipefail

# Dev Session Launcher
# Starts: npm run dev, cloudflared tunnel, and Claude Code remote session
# - Dev server logs are written to logs/dev-server.log (tail -f to follow)
# - Claude Code remote-control runs in the foreground for local interaction
# - Claude Code auto-restarts if the session drops

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
DEV_LOG="$LOG_DIR/dev-server.log"

PIDS=()
SHUTTING_DOWN=false

cleanup() {
  echo ""
  echo "Shutting down..."
  SHUTTING_DOWN=true
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Check required tools
for cmd in cloudflared claude; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is not installed." >&2
    exit 1
  fi
done

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# 1. Start dev server with accessible logs
echo "Starting dev server on port 3000..."
echo "--- Dev server started at $(date) ---" >> "$DEV_LOG"
npm run dev >> "$DEV_LOG" 2>&1 &
PIDS+=($!)

echo "Waiting for dev server..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Error: Dev server did not start within 60s." >&2
    echo "Check logs: $DEV_LOG"
    exit 1
  fi
  sleep 1
done
echo "Dev server ready. Logs: $DEV_LOG"

# 2. Start cloudflared tunnel
TUNNEL_URL="https://dev.desgrava.ar"

echo "Starting cloudflared tunnel..."
CLOUDFLARED_LOG=$(mktemp)
cloudflared tunnel run dev 2>"$CLOUDFLARED_LOG" &
PIDS+=($!)

echo "Waiting for tunnel to be ready..."
for i in $(seq 1 60); do
  if grep -qi 'registered\|connected\|serving' "$CLOUDFLARED_LOG" 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Error: Tunnel not ready within 60s." >&2
    echo "Debug output:"
    cat "$CLOUDFLARED_LOG" >&2
    exit 1
  fi
  sleep 1
done
rm -f "$CLOUDFLARED_LOG"
echo "Tunnel ready: $TUNNEL_URL"

# 3. Start Claude Code remote-control (foreground with auto-restart)
#    Runs in the foreground so you can interact locally.
#    Press 'w' to toggle worktree mode, Ctrl+C to stop everything.

echo ""
echo "Starting Claude Code remote control session..."
echo ""
echo "========================================="
echo "  Dev Session Ready"
echo "========================================="
echo ""
echo "  Tunnel URL:   $TUNNEL_URL"
echo "  Dev logs:     tail -f $DEV_LOG"
echo ""
echo "========================================="
echo ""

printf "%s" "$TUNNEL_URL" | pbcopy
echo "Tunnel URL copied to clipboard."
echo ""
echo "Claude Code remote-control is interactive."
echo "Press Ctrl+C to stop all services."
echo ""

# Run claude remote-control in the foreground with auto-restart
while true; do
  claude remote-control --name "desgrava.ar dev session"

  if [ "$SHUTTING_DOWN" = true ]; then
    break
  fi

  echo ""
  echo "Claude Code session ended. Restarting in 5s..."
  sleep 5

  if [ "$SHUTTING_DOWN" = true ]; then
    break
  fi

  echo "Restarting Claude Code remote control..."
done
