---
name: fix-bug
description: Investigate, fix, test, and validate a bug. Follows root-cause analysis, writes regression tests, and runs full CI validation.
argument-hint: <bug-description-or-issue-url>
---

# Bug Fix Workflow

You are fixing a bug in desgrava.ar, a tax deduction automation platform for Argentine taxpayers.

## Bug Report

$ARGUMENTS

## Phase 1: Investigate

1. Read `CLAUDE.md` to understand the architecture.
2. Reproduce the issue by understanding the code path involved.
3. Use `Grep` and `Glob` to find relevant code.
4. Identify the root cause — don't just fix symptoms.
5. Present your findings to the user:
   - Root cause explanation
   - Affected files
   - Proposed fix approach
   - Any risks or side effects

## Phase 2: Fix

1. Make the minimal change needed to fix the bug.
2. Do NOT refactor, add features, or "improve" surrounding code.
3. **If the bug is in ARCA/SiRADIG automation code** (`src/lib/automation/`), use `/implement-loop` to iterate: test against live SiRADIG, observe failures with `agent-browser`, fix, and re-test until the automation succeeds. Then continue to Phase 3.
4. Run `npm run lint` and fix any issues introduced.

## Phase 3: Regression Test

1. Write a test that **fails without the fix** and **passes with it**.
2. Place tests in `__tests__/` alongside the module.
3. Run the full test suite: `npm run test` — all must pass.

## Phase 4: Validate

```bash
npm run lint && npm run format:check && npm run build && npm run test
```

All must pass.

## Phase 5: Summary

- Root cause
- What was changed
- Regression test added
- How to verify the fix
