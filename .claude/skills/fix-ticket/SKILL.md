---
name: fix-ticket
description: Scheduled agent that fetches open GitHub issues labeled `from-app`, classifies bugs via AI, fixes them with /fix-bug, and creates PRs that close the matched issue.
argument-hint: "--env dev|prod"
---

# Scheduled Bug Fix Agent

You are a scheduled agent for desgrava.ar that automatically fixes bug tickets. Tickets live as GitHub Issues labeled `from-app` on the project repository. You list open issues, classify each one using AI, fix bugs using the `/fix-bug` workflow, and open PRs whose bodies contain `Closes #N` — GitHub auto-closes the issue on merge, and a `.github/workflows/notify-pr-opened.yml` workflow posts a Telegram "fix ready for review" message.

## Arguments

$ARGUMENTS

Parse the `--env` flag from arguments. Valid values: `dev` (default) or `prod`.

The environment flag only controls whether to sync the production database locally (Phase 0). Issue discovery uses `gh` against the live GitHub repo regardless.

## Environment Configuration

`gh` must be authenticated against `nicolasalbani/desgrava.ar`. Run `gh auth status` once at the start; if it fails, stop and report.

For `--env prod`, also require `PROD_DATABASE_URL` (read-only prod DB connection) so Phase 0 can run.

## Phase 0: Sync Prod Database (prod only)

When running with `--env prod`, import the production database into the local dev database so the agent has full access to automation jobs, invoices, receipts, and all related data — matching the dev experience exactly.

### Step 0.1: Dump prod database

```bash
pg_dump "$PROD_DATABASE_URL" \
  --no-owner --no-acl --clean --if-exists \
  --format=custom \
  -f /tmp/prod_dump.pgdump
```

If this fails (connection refused, auth error, missing `PROD_DATABASE_URL`), stop and report — the agent cannot work without prod data.

### Step 0.2: Restore into local dev database

```bash
pg_restore --no-owner --no-acl --clean --if-exists \
  -d "$DATABASE_URL" \
  /tmp/prod_dump.pgdump
```

Warnings about "does not exist" during `--clean` are expected and safe to ignore. Errors during restore are not — stop and report.

### Step 0.3: Sync Prisma migration history

```bash
for migration_dir in prisma/migrations/[0-9]*/; do
  migration_name=$(basename "$migration_dir")
  npx prisma migrate resolve --applied "$migration_name" 2>/dev/null
done
```

### Step 0.4: Regenerate Prisma client (if needed)

```bash
npx prisma generate
```

### Step 0.5: Cleanup

```bash
rm -f /tmp/prod_dump.pgdump
```

**Skip this phase entirely when running with `--env dev`.**

## Phase 1: Fetch Open Issues

List open issues labeled `from-app` from the project repo:

```bash
gh issue list --label from-app --state open --json number,title,body,createdAt --limit 50
```

The body of each issue contains the user's description plus a collapsed conversation log (rendered by `src/lib/github/issues.ts:buildIssueBody`).

If the list is empty, stop and report — nothing to process.

## Phase 2: Classify Issues

For each issue, classify it using OpenAI. Same prompt as the previous ticket flow:

```
You are a support ticket classifier for desgrava.ar, a tax deduction automation platform.

Classify the following support ticket as one of:
- BUG: The user is reporting something that is broken, not working as expected, or producing errors.
- FEATURE_REQUEST: The user is asking for new functionality or an enhancement.
- SUPPORT: The user is asking for help, has a question, or needs guidance.

Ticket subject: <title>
Ticket body: <body>

Respond with JSON only:
{"type": "BUG" | "FEATURE_REQUEST" | "SUPPORT", "confidence": 0.0-1.0, "reasoning": "brief explanation"}
```

**Rules:**

- Only proceed with issues classified as `BUG` with `confidence >= 0.7`.
- Skip non-bug issues silently. Log the classification for transparency.

## Phase 3: Check If Already Fixed

Before attempting any fix, check if a recent commit/PR already addresses the issue:

```bash
# Search recent commits for keywords from the issue
git log --all --since="<issue.createdAt>" --oneline --grep="<keyword>"
git log --all --since="<issue.createdAt>" -p -S "<keyword>" --oneline
```

If a matching commit is found, close the issue with a comment and skip to the next one:

```bash
gh issue close <issue-number> --comment "Already fixed in <commit-sha>: <commit-subject>"
```

If no matching commit, proceed to Phase 4.

## Phase 4: Fix Each Bug (Sequential)

Process bug issues **one at a time** to avoid branch conflicts.

### Step 4.1: Prepare Git State

```bash
git checkout main
git pull origin main
git checkout -b fix/issue-<issue-number>
```

If the branch already exists (a previous attempt), skip this issue.

### Step 4.2: Run /fix-bug

Invoke the `/fix-bug` skill with the issue's title + body:

```
/fix-bug Issue #<number>: <title>

<body>
```

The `/fix-bug` skill will:

1. Investigate and identify the root cause.
2. Implement the minimal fix.
3. Write regression tests.
4. Run full CI validation (`npm run lint && npm run format:check && npm run build && npm run test`).

**If `/fix-bug` fails** (cannot identify root cause, CI doesn't pass, or the issue is not reproducible):

1. Log the failure reason.
2. Clean up: `git checkout main && git branch -D fix/issue-<number>`.
3. Skip to the next issue. Do NOT comment on the issue or open a PR.

### Step 4.3: Push and Create PR

After a successful fix:

```bash
git push -u origin fix/issue-<issue-number>
```

Open a PR. **The body MUST contain `Closes #<issue-number>`** — this is how GitHub auto-closes the issue on merge AND how the `notify-pr-opened.yml` workflow knows to fire the Telegram "fix ready for review" message.

```bash
gh pr create --title "fix(issue-<issue-number>): <short-title>" --body "$(cat <<EOF
Closes #<issue-number>

## Summary

**Issue:** #<issue-number>
**Subject:** <title>

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

Capture the PR URL from the `gh pr create` output. The Telegram notification will be sent automatically by the `notify-pr-opened.yml` workflow — do NOT send it yourself.

### Step 4.4: Return to Main

```bash
git checkout main
```

Proceed to the next bug issue.

## Phase 5: Cleanup & Report

After processing all issues:

1. Ensure you're on `main` branch.
2. Delete any `_tmp_*.ts` files.
3. Report a summary:

```
## Bug Fix Agent Run Summary

- Environment: dev/prod
- Issues fetched (from-app, open): N
- Classified as bugs: N
- Already fixed (closed via git history): N
- Fixes attempted: N
- PRs created: N (list PR URLs)
- Skipped (not bugs): N
- Failed fixes: N (list reasons)
```

## Error Handling

- **`gh` unauthenticated or rate-limited**: Stop and report. Do not attempt fixes without issue data.
- **Classification fails**: Skip the issue, log the error.
- **Git dirty state**: Run `git checkout main && git clean -fd` before processing the next issue.
- **PR creation fails**: Log the error and move on; the issue stays open and will be retried on the next run.
- **Never leave the repo in a dirty state.** Always return to `main` with a clean working tree.
