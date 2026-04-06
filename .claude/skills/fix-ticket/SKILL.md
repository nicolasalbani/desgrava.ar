---
name: fix-ticket
description: Scheduled agent that fetches open support tickets, classifies bugs via AI, fixes them with /fix-bug, creates PRs, updates ticket status, and notifies the developer.
argument-hint: [--env dev|prod]
---

# Scheduled Bug Fix Agent

You are a scheduled agent for desgrava.ar that automatically fixes bug tickets. You fetch open support tickets, classify them using AI, fix bugs using the `/fix-bug` workflow, create PRs, update ticket status, and notify the developer via email.

## Arguments

$ARGUMENTS

Parse the `--env` flag from arguments. Valid values: `dev` (default) or `prod`.

## Environment Configuration

Resolve the API base URL and auth secret based on the environment:

- **dev**: `http://localhost:3000` + `CRON_SECRET` env var
- **prod**: `PROD_API_URL` env var + `PROD_CRON_SECRET` env var

If the required env vars are missing for the selected environment, stop and report the error.

## Phase 1: Fetch Open Tickets

Fetch all open tickets from the support API:

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" <API_BASE_URL>/api/soporte/
```

This returns all `OPEN` tickets with `id`, `subject`, `description`, `conversationLog`, `automationJobId`, `createdAt`.

If the response is empty or an error, stop and report — there are no tickets to process.

## Phase 2: Classify Tickets

For each ticket, determine if it's a bug using AI classification. Use OpenAI (via the Bash tool with `curl` or a temp script) with this prompt structure:

```
You are a support ticket classifier for desgrava.ar, a tax deduction automation platform.

Classify the following support ticket as one of:
- BUG: The user is reporting something that is broken, not working as expected, or producing errors.
- FEATURE_REQUEST: The user is asking for new functionality or an enhancement.
- SUPPORT: The user is asking for help, has a question, or needs guidance.

Ticket subject: <subject>
Ticket description: <description>
Conversation log: <conversationLog>

Respond with JSON only:
{"type": "BUG" | "FEATURE_REQUEST" | "SUPPORT", "confidence": 0.0-1.0, "reasoning": "brief explanation"}
```

**Rules:**

- Only proceed with tickets classified as `BUG` with `confidence >= 0.7`.
- Skip non-bug tickets silently.
- Log skipped tickets with their classification for transparency.

## Phase 3: Check If Already Fixed

Before attempting any fix, check whether each bug ticket has already been addressed by a recent commit or PR. This prevents creating duplicate/wrong fixes for issues that were resolved between ticket creation and agent run.

For each bug ticket:

1. **Search recent commits** for keywords from the ticket (error message, related terms):

```bash
git log --all --since="<ticket.createdAt>" --oneline --grep="<keyword>"
```

Try multiple keywords extracted from the ticket subject and description (e.g. error messages, feature names, domain terms). Also search commit diffs:

```bash
git log --all --since="<ticket.createdAt>" -p -S "<keyword>" --oneline
```

2. **If a matching commit/PR is found**: The bug is already fixed. Update the ticket status to `RESOLVED` with a reference to the commit/PR, and skip to the next ticket. Do NOT attempt a fix or create a branch.

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"status": "RESOLVED", "resolution": "Already fixed in <commit-hash>: <commit-subject>"}' \
  <API_BASE_URL>/api/soporte/<ticket-id>
```

3. **If no matching commit found**: Proceed to Phase 4.

## Phase 4: Fix Each Bug (Sequential)

Process bug tickets **one at a time** to avoid branch conflicts. For each bug ticket:

### Step 4.1: Prepare Git State

```bash
git checkout main
git pull origin main
git checkout -b fix/<ticket-id>
```

If the branch already exists (a previous attempt), skip this ticket.

### Step 4.2: Run /fix-bug

Invoke the `/fix-bug` skill with the ticket's description as the bug report:

```
/fix-bug Ticket <ticket-id>: <subject>

<description>

Additional context from support conversation:
<conversationLog summary>
```

The `/fix-bug` skill will:

1. Investigate and identify the root cause
2. Implement the minimal fix
3. Write regression tests
4. Run full CI validation (`npm run lint && npm run format:check && npm run build && npm run test`)

**If `/fix-bug` fails** (cannot identify root cause, CI doesn't pass, or the issue is not reproducible):

1. Log the failure reason.
2. Clean up: `git checkout main && git branch -D fix/<ticket-id>`
3. Skip to the next ticket. Do NOT update the ticket status or send email.

### Step 4.3: Push and Create PR

After a successful fix:

```bash
git push -u origin fix/<ticket-id>
```

Create a PR using `gh`:

```bash
gh pr create --title "FIX <ticket-id>" --body "$(cat <<'EOF'
## Summary

**Ticket:** <ticket-id>
**Subject:** <subject>
**Reporter description:** <description>

## Root Cause

<root cause explanation from /fix-bug Phase 5>

## Changes

<files changed and what was modified>

## Evidence

### Regression Test
<test name and what it verifies>

### CI Output
<confirmation that lint, format, build, and test all pass>

### Additional Evidence
<screenshots if automation fix, DB query results if data fix, or test output>

## Test Plan

- [ ] Review the root cause analysis
- [ ] Verify regression test covers the reported issue
- [ ] Confirm CI passes on the PR branch
- [ ] Manual verification if applicable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL from the `gh pr create` output.

### Step 4.4: Update Ticket Status

Update the ticket to `IN_PROGRESS` with the PR URL:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS", "resolution": "Fix submitted: <PR_URL>"}' \
  <API_BASE_URL>/api/soporte/<ticket-id>
```

### Step 4.5: Notify Developer

Send an email notification to the developer by calling the API or using a temp script:

```typescript
// _tmp_notify.ts — delete after use
import "dotenv/config";
import { sendBugFixPREmail } from "@/lib/email";

const [ticketSubject, ticketId, prUrl, fixSummary] = process.argv.slice(2);
sendBugFixPREmail(ticketSubject, ticketId, prUrl, fixSummary)
  .then(() => {
    console.log("Email sent");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Email failed:", e.message);
    process.exit(1);
  });
```

```bash
npx tsx _tmp_notify.ts "<subject>" "<ticket-id>" "<pr-url>" "<fix-summary>"
rm _tmp_notify.ts
```

### Step 4.6: Return to Main

```bash
git checkout main
```

Proceed to the next bug ticket.

## Phase 5: Cleanup & Report

After processing all tickets:

1. Ensure you're on `main` branch.
2. Delete any `_tmp_*.ts` files.
3. Report a summary:

```
## Bug Fix Agent Run Summary

- Environment: dev/prod
- Tickets fetched: N
- Classified as bugs: N
- Already fixed (resolved via git history): N
- Fixes attempted: N
- PRs created: N (list PR URLs)
- Skipped (not bugs): N
- Failed fixes: N (list reasons)
```

## Error Handling

- **API unreachable**: Stop and report. Do not attempt fixes without ticket data.
- **Classification fails**: Skip the ticket, log the error.
- **Git dirty state**: Run `git checkout main && git clean -fd` before processing the next ticket.
- **PR creation fails**: Log the error, still attempt to update ticket status if the branch was pushed.
- **Email fails**: Log the error but do not block — email is non-critical.
- **Never leave the repo in a dirty state.** Always return to `main` with a clean working tree.
