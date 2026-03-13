---
name: implement-loop
description: Autonomous implementation loop — keeps coding and fixing until lint, format, build, and all tests pass. The "Ralph Loop" for background agents.
argument-hint: <task-description>
---

# Autonomous Implementation Loop

You are running an autonomous implementation loop for desgrava.ar. Your goal is to complete the task and ensure ALL CI checks pass.

## Task

$ARGUMENTS

## Loop Protocol

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

### Step 5: Report

Provide a summary:

- Task completed: yes/no
- Iterations needed
- Files created/modified
- Tests added
- Any issues encountered
