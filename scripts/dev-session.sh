#!/usr/bin/env bash
set -euo pipefail

# Dev Session Launcher
# Starts: npm run dev, cloudflared tunnel, and Claude Code remote session
# Outputs both URLs and copies them to clipboard

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
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

# 1. Start dev server
echo "Starting dev server on port 3000..."
npm run dev &>/dev/null &
PIDS+=($!)

echo "Waiting for dev server..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Error: Dev server did not start within 60s." >&2
    exit 1
  fi
  sleep 1
done
echo "Dev server ready."

# 2. Start cloudflared tunnel
echo "Starting cloudflared tunnel..."
CLOUDFLARED_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:3000 2>"$CLOUDFLARED_LOG" &
PIDS+=($!)

echo "Waiting for tunnel URL..."
TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$CLOUDFLARED_LOG" 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: Could not get tunnel URL within 30s." >&2
    exit 1
  fi
  sleep 1
done
rm -f "$CLOUDFLARED_LOG"
echo "Tunnel ready."

# 3. Start Claude Code remote control session
echo "Starting Claude Code remote control session..."
CLAUDE_LOG=$(mktemp)
claude remote-control --name "desgrava.ar dev session" >"$CLAUDE_LOG" 2>&1 &
PIDS+=($!)

echo "Waiting for Claude Code session URL..."
CLAUDE_URL=""
for i in $(seq 1 60); do
  CLAUDE_URL=$(grep -o 'https://[^ ]*' "$CLAUDE_LOG" 2>/dev/null | head -1 || true)
  if [ -n "$CLAUDE_URL" ]; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Error: Could not get Claude Code session URL within 60s." >&2
    echo "Debug output:"
    cat "$CLAUDE_LOG" >&2
    exit 1
  fi
  sleep 1
done
echo "Claude Code remote control ready."

# 4. Output results
echo ""
echo "========================================="
echo "  Dev Session Ready"
echo "========================================="
echo ""
echo "  Tunnel URL:       $TUNNEL_URL"
echo "  Claude Code URL:  $CLAUDE_URL"
echo ""
echo "========================================="

# 5. Copy to clipboard
printf "%s\n%s" "$TUNNEL_URL" "$CLAUDE_URL" | pbcopy
echo "Both URLs copied to clipboard."

# Keep running until interrupted
echo ""
echo "Press Ctrl+C to stop all services."
wait
