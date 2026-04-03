---
title: Dev Session Launcher Script
status: implemented
priority: medium
---

## Summary

A shell script that launches a full remote development session in one command: starts the Next.js dev server (`npm run dev` on port 3000), opens a Cloudflare Tunnel via `cloudflared` to expose it publicly, and starts a remote Claude Code session. The script outputs both the Cloudflare tunnel URL and the Claude Code remote session URL, and automatically copies them to the clipboard for easy sharing.

## Acceptance Criteria

- [ ] Script starts `npm run dev` in the background on port 3000
- [ ] Script starts `cloudflared tunnel --url http://localhost:3000` and captures the generated public URL
- [ ] Script starts a remote Claude Code session (`claude --remote`) and captures the session URL
- [ ] Both URLs (Cloudflare tunnel + Claude Code remote session) are printed to stdout clearly labeled
- [ ] Both URLs are automatically copied to the clipboard (using `pbcopy` on macOS)
- [ ] Script handles cleanup on exit (SIGINT/SIGTERM): kills `npm run dev`, `cloudflared`, and any background processes
- [ ] Script checks that required tools are installed (`cloudflared`, `claude`) and exits with a clear error if missing
- [ ] Script waits for each service to be ready before proceeding (e.g., waits for dev server to respond on port 3000 before starting cloudflared)

## Technical Notes

- Place the script at `scripts/dev-session.sh` (create `scripts/` dir if needed) and make it executable.
- Use `cloudflared tunnel --url http://localhost:3000` for the quick tunnel (no Cloudflare account needed). Parse the tunnel URL from cloudflared's stderr output (it logs `https://*.trycloudflare.com`).
- Use `claude code --remote` (or the appropriate CLI flag) to start a remote Claude Code session. Capture the session URL from stdout.
- Use a `trap` handler to clean up all background processes on script exit.
- Use `pbcopy` for clipboard (macOS). Format clipboard content as both URLs separated by a newline.
- Wait for port 3000 to be available before starting cloudflared (poll with `curl -s http://localhost:3000 > /dev/null` or `lsof -i :3000`).
- Wait for cloudflared to output the tunnel URL before starting Claude Code session.

## Out of Scope

- Windows/Linux clipboard support (macOS-only via `pbcopy`)
- Custom port configuration (hardcoded to 3000)
- Cloudflare Tunnel with named tunnels or authentication (uses quick tunnels only)
- Integration with CI/CD or deployment workflows
- Automatic browser opening
