---
title: Scheduled Bug Fix Agent
status: implemented
priority: high
---

## Summary

A scheduled Claude Code agent that periodically scans open support tickets, uses AI to classify whether each ticket is a bug report, and automatically fixes bugs using the `/fix-bug` skill. The agent connects to both local (dev) and production databases to fetch tickets. When a fix is implemented, it pushes to a `fix/<ticket-id>` branch, opens a GitHub PR named "FIX <ticket-id>" with an explanation and evidence (screenshots, test output, DB queries), updates the ticket status to `IN_PROGRESS`, and sends an email notification to the developer with the PR link and ticket details for review.

## Acceptance Criteria

- [ ] A new Claude Code skill `/fix-ticket` exists at `.claude/skills/fix-ticket/SKILL.md` that orchestrates the full workflow: fetch ticket → classify → fix → branch → PR → update status → notify developer
- [ ] A Claude Code scheduled trigger (via `/schedule`) runs the agent on a configurable cron interval (default: every 30 minutes)
- [ ] The agent accepts an `--env` flag (`dev` or `prod`) to determine which database/API to query for open tickets; defaults to `dev`
- [ ] The agent fetches all `OPEN` tickets from `GET /api/soporte/` (authenticated via `CRON_SECRET` bearer token)
- [ ] Each ticket is classified by AI (OpenAI) as `BUG`, `FEATURE_REQUEST`, or `SUPPORT` based on `subject`, `description`, and `conversationLog` — only `BUG` tickets proceed
- [ ] The `GET /api/soporte/` endpoint supports admin access via `CRON_SECRET` bearer token (returns all open tickets, not just one user's)
- [ ] For each bug ticket, the agent creates a branch `fix/<ticket-id>`, runs the `/fix-bug` workflow with the ticket's description as input, and commits the fix
- [ ] The agent pushes the branch and opens a PR via `gh pr create` titled "FIX <ticket-id>" with a body containing: root cause, files changed, regression test added, and evidence (test output, screenshots if automation, DB query results if applicable)
- [ ] After the PR is created, the agent updates the ticket status to `IN_PROGRESS` via `PATCH /api/soporte/<ticket-id>` with bearer token auth, and sets `resolution` to a message containing the PR URL
- [ ] After the PR is created, an email is sent to the developer (`SUPPORT_EMAIL` env var) with: ticket subject, ticket ID, a summary of the fix, and a direct link to the PR for review
- [ ] If the `/fix-bug` workflow fails (cannot identify root cause or CI doesn't pass), the agent skips that ticket and logs the failure — does not update ticket status or send email
- [ ] The agent processes tickets sequentially (one at a time) to avoid branch conflicts
- [ ] Environment configuration uses env vars: `PROD_API_URL` for production API base URL, `PROD_CRON_SECRET` for production auth; local uses `http://localhost:3000` and `CRON_SECRET`

## Technical Notes

- **Skill location**: `.claude/skills/fix-ticket/SKILL.md` — follows existing skill patterns (see `fix-bug`, `implement-loop`)
- **Scheduled trigger**: Use Claude Code's `/schedule` to create a cron trigger that invokes the skill. The trigger config should be stored so it persists across sessions.
- **Ticket fetching**: The existing `GET /api/soporte/` route only returns tickets for the authenticated user's session. A new admin mode is needed: when the request includes `Authorization: Bearer <CRON_SECRET>`, return all `OPEN` tickets (no user filter). This mirrors the pattern already used in `PATCH /api/soporte/[id]/route.ts` (line 10).
- **AI classification**: Use OpenAI (same client as `src/lib/soporte/`) with a focused prompt that receives `subject`, `description`, and `conversationLog`, and returns a JSON object `{ type: "BUG" | "FEATURE_REQUEST" | "SUPPORT", confidence: number, reasoning: string }`. Only proceed if `type === "BUG"` and `confidence >= 0.7`.
- **Git workflow**: Before starting each ticket fix, ensure `main` is up to date (`git pull origin main`), then create `fix/<ticket-id>` from `main`. After fix + CI pass, push and create PR.
- **PR body format**: Use the fix-bug skill's Phase 5 summary output as the PR body content, wrapped in the standard PR template (`## Summary`, `## Evidence`, `## Test plan`).
- **Status update**: Use `PATCH /api/soporte/<ticket-id>` with `Authorization: Bearer <CRON_SECRET>` (or `PROD_CRON_SECRET` for prod), body: `{ "status": "IN_PROGRESS", "resolution": "Fix submitted: <PR-URL>" }`.
- **Email notification**: Add a new `sendBugFixPREmail(ticketSubject, ticketId, prUrl, fixSummary)` function in `src/lib/email.ts` using Resend (same pattern as `sendNewTicketEmail`). Sends to `SUPPORT_EMAIL` (the developer's email, already used for new ticket notifications). The email should include: ticket subject, ticket ID, a brief summary of the root cause and fix, and a button/link to the GitHub PR. Send after the PR is created and ticket status is updated.
- **Environment switching**: The skill should accept a parameter for environment. The API base URL and auth secret are resolved from env vars based on the chosen environment.
- **Error handling**: If any step fails (classification uncertain, fix-bug fails, CI fails, PR creation fails), log the error and skip to the next ticket. Never leave the repo in a dirty state — `git checkout main && git clean -fd` on failure.

## Out of Scope

- Automatic merging of PRs (human review required)
- Handling `FEATURE_REQUEST` or `SUPPORT` ticket types
- Slack/WhatsApp notifications (email only)
- Multi-repo support (only works with desgrava.ar)
- Ticket priority/severity ranking (processes all open bug tickets in creation order)
- Production deployment of fixes (only creates PRs)
- UI for viewing agent activity or fix history
- Notifying the end user about the fix (only developer is notified)
