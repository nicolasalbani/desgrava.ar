---
title: Lenny's MCP Integration for Spec Authoring
status: implemented
priority: medium
---

## Summary

Wire Lenny Rachitsky's data MCP server (`https://mcp.lennysdata.com/mcp`) into this repo so Claude Code can query proven product, marketing, and pricing playbooks during day-to-day work. As a first concrete use, update the `/write-spec` skill so that whenever a feature request touches product (onboarding, activation, retention), marketing (positioning, channels, messaging), or pricing/monetization, the skill consults Lenny's MCP and grounds the resulting spec in best-practice frameworks. The product is currently at zero paying users, targets Argentine taxpayers (Spanish UI), and the immediate north star is reaching the first 1000 users — these constraints should be baked into how the skill prompts the MCP.

## Acceptance Criteria

- [ ] `.mcp.json` exists at the repo root (committed) and registers the Lenny server with name `lennys-data`, transport `http`, and URL `https://mcp.lennysdata.com/mcp`
- [ ] Opening Claude Code in this repo surfaces tools prefixed with `mcp__lennys-data__*` (verifiable via the MCP server list at session start)
- [ ] First-time tool call triggers Claude Code's native OAuth flow against the MCP server; once authorized, subsequent sessions reuse the credential without re-prompting
- [ ] `.claude/skills/write-spec/SKILL.md` adds a new **Phase 1.5 — Consult Domain Knowledge** section that:
  - Lists trigger keywords (`product`, `onboarding`, `activation`, `retention`, `pricing`, `monetization`, `positioning`, `messaging`, `growth`, `acquisition`, `marketing`, `channel`, `launch`, `PMF`, `landing`, `conversion`)
  - Instructs Claude to discover available Lenny tools at runtime and pick the most relevant ones (no hardcoded tool names — the MCP catalog may evolve)
  - Pins context that every query carries: "B2C SaaS for Argentine taxpayers, Spanish-only UI, currently zero paying users, goal of first 1000 users, 30-day free trial then MercadoPago subscription"
  - Requires the skill to cite which Lenny resources/frameworks informed each Acceptance Criteria item or Technical Note (e.g., short inline notes like `[Lenny: <framework>]`)
- [ ] The skill degrades gracefully when the MCP is unreachable or unauthenticated: it logs a single line stating the MCP was skipped and proceeds with template-only guidance (no hard failure, no retry loop)
- [ ] When the feature description has no product/marketing/pricing signal (e.g., a pure technical refactor), the skill explicitly skips the MCP and notes that in its working summary so it doesn't waste calls
- [ ] `CLAUDE.md` adds a one-line entry under the existing **Skills** section pointing to Lenny's MCP and the trigger keywords, so future contributors know it's wired in
- [ ] A smoke test: running `/write-spec "improve onboarding activation rate"` after the change produces a draft whose Technical Notes reference at least one Lenny-derived framework, and running `/write-spec "validate CUIT format"` produces a draft that explicitly skipped the MCP

## Technical Notes

- **MCP config location**: Claude Code reads project-shared MCP servers from `.mcp.json` at the repo root, alongside `package.json`. This file is committed (unlike `.claude/settings.local.json`, which is per-machine). Schema: `{ "mcpServers": { "lennys-data": { "type": "http", "url": "https://mcp.lennysdata.com/mcp" } } }`.
- **Transport**: the URL ends in `/mcp`, which is the HTTP transport convention (SSE servers typically expose `/sse`). Use `"type": "http"`. If the first call returns a 405/upgrade hint, fall back to `"type": "sse"`.
- **Authorization**: Claude Code handles MCP OAuth natively — no need to manage tokens manually. The first tool invocation opens a browser flow; the credential is stored in the user's Claude Code keychain and is not committed.
- **Skill structure**: the existing `/write-spec` skill already has Phase 1 (context gathering), Phase 2 (clarify), Phase 3 (draft), Phase 4 (write). Insert Phase 1.5 between context gathering and clarification so the MCP signal informs which clarifying questions are even worth asking.
- **No hardcoded tool names**: Lenny's server may add/rename tools over time. The skill should rely on Claude's session-time tool awareness rather than referencing specific `mcp__lennys-data__<tool>` names.
- **Argentina constraints**: Lenny's content is largely US/global. The skill must instruct Claude to translate frameworks into Argentine context — channels (LinkedIn AR, Instagram AR, Twitter/X AR, WhatsApp groups, contadores referrals), pricing in ARS, regulatory constraints (ARCA), and Spanish-language messaging.
- **No app-code or DB changes**: this is purely tooling/skills configuration. No Prisma migration, no API route, no UI work.
- **Citation format**: keep Lenny references inline and lightweight (e.g., `[Lenny: Sean Ellis activation framework]`) so specs don't bloat. The goal is traceability, not academic citation.
- **Failure modes to handle**: (a) MCP server returns 401 — prompt user to re-auth and continue without; (b) network timeout — log and skip; (c) tool list empty — log and skip. In all three, write the spec without MCP input rather than blocking.

## Out of Scope

- Producing the actual 0→1000 GTM plan, marketing artifacts, or pricing experiments. Those are follow-up specs that will be authored _using_ this new skill.
- Building scheduled agents that call the MCP on a cron (no `/loop`, no `/schedule` integration). The MCP is consulted on-demand via `/write-spec` only.
- Integrating Lenny's MCP into other skills (`/fix-bug`, `/new-feature`, `/implement-loop`, etc.). Future work, not this spec.
- Surfacing Lenny content inside the desgrava.ar product itself (e.g., in-app coaching, support chat, etc.).
- Caching or persisting MCP responses to disk. Each session starts fresh.
- Automatic translation of Lenny's English-language content into Spanish — Claude handles that inline when drafting.
- Adding any UI in the dashboard, landing page, or settings to surface Lenny insights.
