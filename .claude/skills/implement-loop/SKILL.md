---
name: implement-loop
description: Autonomous implementation loop — keeps coding and fixing until lint, format, build, and all tests pass. The "Ralph Loop" for background agents.
argument-hint: <task-description>
---

# Autonomous Implementation Loop

You are running an autonomous implementation loop for desgrava.ar. Your goal is to complete the task and ensure ALL CI checks pass.

## Task

$ARGUMENTS

## Detecting Automation Tasks

Before starting, determine if this task involves **ARCA/SiRADIG browser automation** (i.e., changes to `src/lib/automation/` navigators, selectors, or deduction flows). If it does, follow the **Automation Loop** below. Otherwise, follow the **CI Loop**.

---

## Automation Loop (for ARCA/SiRADIG tasks)

When the task involves browser automation (implementing or fixing navigator flows, selectors, form filling, or SiRADIG interactions), use this loop instead of the CI loop. Max 10 iterations.

### Step A1: Implement or Fix

If this is the first iteration, implement the automation code.
If this is a subsequent iteration, fix the failures from the previous run.

### Step A2: Test Against Live SiRADIG

Trigger the automation against the real ARCA/SiRADIG environment:

1. Create an automation job in the DB for the target invoice/receipt.
2. Run `processJob(jobId)` directly via a temp script (see pattern below).
3. If it **succeeds** → proceed to Step A4.
4. If it **fails** → read the job logs and error message, then go to Step A3.

**Pattern to run a job directly:**

```typescript
// _tmp_run_job.ts
import "dotenv/config";
import { processJob } from "@/lib/automation/job-processor";
const jobId = process.argv[2];
processJob(jobId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

```bash
npx tsx _tmp_run_job.ts <jobId>
```

### Step A3: Observe with agent-browser

When the automation fails, use `agent-browser` to manually walk through the SiRADIG flow and understand the actual DOM structure:

1. Login to ARCA using the `.env` credentials (`ARCA_AGENT_USERNAME` / `ARCA_AGENT_PASSWORD`).
2. Navigate to SiRADIG and reproduce the exact flow the automation follows.
3. Use `agent-browser snapshot -i` and `agent-browser eval` to inspect DOM elements, jQuery event handlers, and dialog behavior.
4. Key things to check:
   - **Selector accuracy**: Do the CSS selectors in `selectors.ts` match the actual DOM?
   - **jQuery event delegation**: SiRADIG uses old jQuery `.live()` — events may be on child elements (e.g., `span` inside `div`), not on the element the code clicks.
   - **Native dialogs**: SiRADIG uses `window.confirm()` for delete confirmations — override it with `window.confirm = () => true` before triggering clicks.
   - **AJAX timing**: Some actions need `networkidle` waits; others need explicit element waits.
5. Fix the automation code based on what you observed.
6. Go back to Step A2.

### Step A4: Run CI Checks

After the automation succeeds against live SiRADIG, run the standard CI checks:

```bash
npm run lint && npm run format:check && npm run build && npm run test
```

If any fail, fix and re-run. Clean up any `_tmp_*.ts` files.

### Step A5: Finalize & Report

1. Run `npx prettier --write .` to ensure consistent formatting.
2. Run the full CI check one final time.
3. If the task introduced new patterns, update `CLAUDE.md`.
4. Provide a summary (see Report section below).

---

## CI Loop (for non-automation tasks)

Repeat the following cycle until all checks pass (max 10 iterations):

### Step 1: Implement or Fix

If this is the first iteration, implement the task.
If this is a subsequent iteration, fix the failures from the previous run.

### Step 2: Run All Checks

Run these commands sequentially. If any fail, go back to Step 1.

```bash
npm run lint
npm run format:check
npm run build
npm run test
```

### Step 3: Check Results

- If ALL pass → proceed to Step 4
- If ANY fail → read the error output, diagnose the issue, fix it, and go back to Step 2
- Track iteration count. If you've hit 10 iterations, stop and report what's blocking you.

### Step 4: Finalize

1. Run `npx prettier --write .` to ensure consistent formatting.
2. Run the full check one final time to confirm.
3. If the task introduced new patterns, update `CLAUDE.md`.

---

## Report

Provide a summary:

- Task completed: yes/no
- Iterations needed
- Files created/modified
- Tests added
- Any issues encountered
