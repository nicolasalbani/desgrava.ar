---
title: Replace Support Tickets with GitHub Issues
status: implemented
priority: medium
---

## Summary

The in-app support ticket system stores tickets in a Postgres table (`SupportTicket`) that nobody reads — there is no developer UI for tickets, only Telegram + email notifications and the `/fix-ticket` agent. GitHub Issues is already the source of truth for engineering work, so this feature replaces the bespoke ticket DB with GitHub Issues. When a user escalates from the Ganancio chat, the app creates a public issue in `nicolasalbani/desgrava.ar` labeled `from-app`, posts a Telegram notification, and never writes to a Postgres ticket table again. A new GitHub Actions workflow watches `pull_request: opened` and sends a "fix ready for review" Telegram message when a PR references a `from-app` issue. The `SupportTicket` model, table, related API routes, and email helpers are deleted. `/fix-ticket` is rewritten to query open `from-app` GitHub issues instead of the Postgres table.

## Acceptance Criteria

- [ ] A new `src/lib/github/issues.ts` module exports `createSupportIssue({ subject, description, userEmail, pageUrl, automationJobId, conversationLog }) → { number, url }` that calls the GitHub REST API (`POST /repos/{owner}/{repo}/issues`) with the `from-app` label, returns the issue number + html_url, and throws on non-2xx
- [ ] The chat `create_ticket` tool in [src/app/api/soporte/chat/route.ts](src/app/api/soporte/chat/route.ts) creates a GitHub issue (instead of a `SupportTicket` row), persists `githubIssueNumber` + `githubIssueUrl` on the `SupportConversation`, fires the Telegram notification, and returns the issue number to the model in the same `{ success, ticketId, message }` shape (with `ticketId` = `#<issueNumber>`)
- [ ] The "duplicate ticket" guardrail in the same handler now checks `SupportConversation.githubIssueNumber` instead of `SupportTicket.conversationId`, so the user-facing "ya existe un ticket para esta conversación" behavior is preserved
- [ ] `SupportConversation` gains two nullable fields via Prisma migration: `githubIssueNumber Int?` and `githubIssueUrl String?`; no index needed (only ever read alongside the parent conversation)
- [ ] The `SupportTicket` model, `SupportTicketStatus` enum, `User.supportTickets` relation, and `AutomationJob.supportTickets` relation are removed from `prisma/schema.prisma`, and a destructive migration drops the `SupportTicket` table
- [ ] `/api/soporte/route.ts` (GET + POST) and `/api/soporte/[id]/route.ts` (PATCH) are deleted; nothing else in `src/` references them after removal (verified by grep)
- [ ] `sendNewTicketEmail`, `sendTicketResolvedEmail`, and `sendBugFixPREmail` are removed from [src/lib/email.ts](src/lib/email.ts) along with their tests in [src/lib/**tests**/email.test.ts](src/lib/__tests__/email.test.ts); call sites in the chat route + `/fix-ticket` skill are updated to drop these calls (Telegram replaces them)
- [ ] `sendNewTicketNotification` in [src/lib/telegram.ts](src/lib/telegram.ts) is updated (or replaced by `sendNewGithubIssueNotification`) to accept `{ issueNumber, issueUrl, subject, description, userEmail, pageUrl, automationJobId }` and renders a message linking directly to the GitHub issue
- [ ] A new `sendFixReadyForReviewNotification({ issueNumber, issueUrl, prNumber, prUrl, prTitle })` Telegram helper exists in [src/lib/telegram.ts](src/lib/telegram.ts) for the GitHub Actions workflow to call
- [ ] A new GitHub Actions workflow `.github/workflows/notify-pr-opened.yml` runs on `pull_request: opened` (any branch, against `main`), parses the PR body for `Closes #<n>` / `Fixes #<n>` / `Resolves #<n>` references, checks each referenced issue for the `from-app` label via `gh api`, and for each match posts a Telegram message by calling a small Node script that imports `sendFixReadyForReviewNotification` (or invokes the Telegram API inline if pulling the app into Actions is too heavy)
- [ ] The chat UI in [src/components/soporte/chat-message.tsx](src/components/soporte/chat-message.tsx) renders the `ticket_created` event as "Ticket #<issueNumber> creado" linking to `issueUrl` in a new tab (instead of the current 6-char id slice)
- [ ] The `hasTicket` flag in [src/app/api/soporte/conversaciones/route.ts](src/app/api/soporte/conversaciones/route.ts) and [src/app/api/soporte/conversaciones/[id]/route.ts](src/app/api/soporte/conversaciones/[id]/route.ts) now derives from `c.githubIssueNumber !== null` (the "Ticket abierto" badge in [src/components/soporte/conversations-list.tsx](src/components/soporte/conversations-list.tsx) keeps working with no UI change)
- [ ] The `/fix-ticket` skill at [.claude/skills/fix-ticket/SKILL.md](.claude/skills/fix-ticket/SKILL.md) is rewritten to: list open issues with `gh issue list --label from-app --state open --json number,title,body,createdAt`, classify each via OpenAI (BUG / FEATURE_REQUEST / SUPPORT, same prompt as today), run `/fix-bug` for bugs, push `fix/issue-<number>` branches, open PRs whose body contains `Closes #<number>` (so the GitHub Actions workflow fires the Telegram message and GitHub auto-closes the issue on merge); no more `PATCH /api/soporte/<id>` calls
- [ ] The `/fix-ticket` skill no longer calls `sendBugFixPREmail` (the GitHub Actions workflow handles the notification); the prod DB sync phase (Phase 0) is retained — fix-ticket still needs prod data to reproduce bugs
- [ ] Two new env vars are documented in `CLAUDE.md` and added to `.env.example`: `GITHUB_TOKEN` (PAT with `repo` scope, used by the Next.js app to create issues) and `GITHUB_REPO` (e.g. `nicolasalbani/desgrava.ar`); if either is missing, `createSupportIssue` throws a clear error before any Telegram side effect
- [ ] Unit tests for `src/lib/github/issues.ts` cover: successful creation (mocked fetch), missing-env-var error, non-2xx API error, request body shape (title/body/labels)
- [ ] Unit tests for the updated Telegram helpers cover the new `sendNewGithubIssueNotification` and `sendFixReadyForReviewNotification` message formatting (MarkdownV2 escaping, presence of issue/PR URL)
- [ ] `npm run lint && npm run format:check && npm run build && npm run test` all pass
- [ ] `CLAUDE.md` is updated: the support chat bullet drops the `SupportTicket` reference and instead documents the GitHub issue flow; the API routes list under "API routes" drops `/api/soporte/[id]` and the GET/POST on `/api/soporte/`; the env vars section adds `GITHUB_TOKEN` + `GITHUB_REPO`; the testing section drops `email` ticket helper tests

## Technical Notes

- **GitHub API client**: use plain `fetch` — no Octokit dependency. Pattern matches existing third-party integrations like [src/lib/telegram.ts](src/lib/telegram.ts) and [src/lib/mercadopago/](src/lib/mercadopago/) where the SDK overhead isn't worth it. Endpoint: `POST https://api.github.com/repos/${GITHUB_REPO}/issues`, headers `Authorization: Bearer ${GITHUB_TOKEN}`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
- **Issue body template**: markdown with collapsible `<details>` blocks for the conversation log (keeps the issue readable but preserves the full context). Include `User: <email>`, `Page: <pageUrl>`, `Automation job: <id>` (linking to `https://desgrava.ar/automatizacion?job=<id>` if convenient), then the user's description, then a collapsible conversation log.
- **Issue is public**: since the answer was "Public nicolasalbani/desgrava.ar repo", every issue body will contain the user's email and the chat transcript. Add a one-line warning in the issue creation path: log a `console.warn` on first use noting that this data ends up public, and update the user-facing system prompt in [src/lib/soporte/system-prompt.ts](src/lib/soporte/system-prompt.ts) so Ganancio mentions "tu reporte se compartirá con el equipo de desarrollo" once before creating — minimizes the chance a user posts something they didn't realize would be visible.
- **Issue label**: `from-app`. Create it manually once in the GitHub UI (or document the `gh label create from-app --color FF6B35` step in `CLAUDE.md`); don't bake label creation into the runtime path.
- **Migration**: single migration `drop_support_ticket_table_add_github_fields_to_conversation` runs (1) `ALTER TABLE "SupportConversation" ADD COLUMN "githubIssueNumber" INTEGER, ADD COLUMN "githubIssueUrl" TEXT;` then (2) `DROP TABLE "SupportTicket";` then (3) `DROP TYPE "SupportTicketStatus";`. Data loss is acceptable per the user request — existing tickets are not migrated. (If any open tickets exist at deploy time, manually re-file them as issues before deploying.)
- **GitHub Actions workflow secrets**: the workflow needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` as repo secrets so it can POST to the Telegram API directly (no need to spin up the Next.js app inside the Action). Inline a 15-line `curl` or `node -e` call rather than importing app code — keeps the Action fast and decoupled.
- **GitHub Actions PR-issue parsing**: use `gh pr view ${{ github.event.pull_request.number }} --json body,closingIssuesReferences` — `closingIssuesReferences` is the GraphQL-backed list of issues this PR closes via "Closes #N" syntax, so we don't have to regex the body ourselves. For each entry, check labels and dispatch.
- **`/fix-ticket` skill API surface change**: the env vars `PROD_API_URL` and `PROD_CRON_SECRET` are no longer needed for ticket fetching (use `gh` against the public repo). They're still listed in `CLAUDE.md` for `PROD_DATABASE_URL` adjacency (cron workflows use them), so just remove the ticket-related notes — don't touch the env section beyond what's necessary.
- **Chat tool naming**: keep the function name `create_ticket` (it's user-visible terminology in the system prompt and the user thinks of it as "abrir un ticket"). Only the implementation changes — model interface stays identical to avoid prompt-tuning regression.
- **No retroactive backfill of `SupportConversation.githubIssueNumber`**: existing conversations stay `null` even if they had a ticket pre-deletion. The "Ticket abierto" badge will disappear for old conversations — acceptable since there's no longer anywhere meaningful to link to.
- **No UI changes besides chat-message link**: there is no developer-facing tickets page in the app today (verified via grep — only the chat panel surfaces ticket state), so no admin UI work is needed.

## Out of Scope

- Migrating existing `SupportTicket` rows to GitHub Issues — table is dropped, data is lost (user requested)
- Webhook from GitHub back to the app to sync issue close → user notification (no user-facing resolution email; the chat history is the user's only artifact)
- GitHub App / fine-grained tokens — uses a classic PAT with `repo` scope for simplicity
- Multi-repo support (`GITHUB_REPO` is a single string)
- Linear / Jira / any other tracker
- A `/api/webhooks/github` route — the GitHub Actions workflow handles the PR-opened signal; no inbound webhook is needed
- An in-app issues dashboard or admin view — engineers use github.com
- Rate-limit handling for the GitHub API — the volume (a few issues per day at most) is far below the 5000 req/hr authenticated limit; one retry would be overkill
- Auto-labeling beyond `from-app` (e.g. severity, category) — out of scope for this pass
- Updating `sendNewUserNotification` or `sendCatalogReviewProposal` (those Telegram helpers are unrelated and stay as-is)
