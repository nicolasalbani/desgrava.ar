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

## Phase 2: Fix & Validate

1. Make the minimal change needed to fix the bug.
2. Do NOT refactor, add features, or "improve" surrounding code.
3. **If the bug involves automation code** (`src/lib/automation/`), you MUST run the actual automation against live ARCA/SiRADIG and confirm it succeeds. **Unit tests and code review are NOT sufficient** — the only proof a fix works is a successful job run. Follow the **Automation Validation Loop** below.
4. **If the bug involves import/classification/data pipeline** (`src/lib/catalog/`, `src/lib/ocr/`): After making the fix, query the local database to verify the fix resolves the reported issue. Check for stale cached data (e.g., ProviderCatalog entries) that may bypass the fix. If stale data exists, clean it up AND add code to handle it going forward.
5. **If the fix touches UI components**, ensure the fix is mobile-friendly:
   - Use responsive classes (`sm:`, `md:`, `lg:`) — never fixed widths without mobile breakpoints.
   - Test that layouts don't overflow on small screens (min 320px width).
   - Menus, modals, and sheets should be full-width on mobile (`w-full sm:w-[fixed]`).
   - Tables should use card layouts or horizontal scroll on mobile.
   - Touch targets must be at least 44px.
6. Run `npm run lint` and fix any issues introduced.

### Automation Validation Loop (MANDATORY for automation bugs)

When the bug involves ARCA/SiRADIG browser automation, iterate until the automation **actually succeeds against live SiRADIG**. Max 5 iterations.

#### Step V1: Run the Automation

Create and run a job against ARCA/SiRADIG using the test CUIT (`20314468849`):

1. Find or create an automation job for the affected invoice/receipt in the local DB.
2. Run it using a temp script:

```typescript
// _tmp_run_job.ts — delete after validation
import "dotenv/config";
import { processJob } from "@/lib/automation/job-processor";
const jobId = process.argv[2];
processJob(jobId)
  .then(() => {
    console.log("SUCCESS");
    process.exit(0);
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
```

```bash
npx tsx _tmp_run_job.ts <jobId>
```

3. After the job finishes, check its status in the DB:

```sql
SELECT status, "errorMessage", "currentStep" FROM "AutomationJob" WHERE id = '<jobId>';
```

4. **If status = COMPLETED** → the fix works. Proceed to Phase 3.
5. **If status = FAILED** → read the error, go to Step V2.

#### Step V2: Diagnose with agent-browser

When the job fails, use `agent-browser` to manually walk through the exact SiRADIG flow and understand what went wrong:

1. Login to ARCA using `.env` credentials (`ARCA_AGENT_USERNAME` / `ARCA_AGENT_PASSWORD`).
2. Navigate to SiRADIG and reproduce the exact flow the automation code follows.
3. Use `agent-browser snapshot -i` and `agent-browser eval` to inspect actual DOM elements.
4. Key things to check:
   - **Selector accuracy**: Do the CSS selectors match the actual DOM?
   - **Element visibility**: Is the element hidden, inside a dialog, or behind an overlay?
   - **Strict mode**: Are locators resolving to multiple elements? Scope to the correct container.
   - **jQuery event delegation**: SiRADIG uses old jQuery — events may be on child elements.
   - **AJAX timing**: Some actions need `networkidle` waits; others need explicit element waits.
5. Compare what you see in the browser with what the automation code expects.

#### Step V3: Fix and Re-run

1. Apply the fix based on what you observed.
2. Reset the job status so it can be re-run:

```sql
UPDATE "AutomationJob" SET status = 'PENDING', "errorMessage" = NULL, "currentStep" = NULL, "startedAt" = NULL, "completedAt" = NULL WHERE id = '<jobId>';
```

3. Go back to Step V1.

#### Step V4: Cleanup

After validation succeeds:

1. Delete any `_tmp_*.ts` files.
2. **Do NOT skip this step.** Temp files must not be committed.

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
- **For automation fixes**: Include the job ID and DB query showing `status = 'COMPLETED'` as proof the fix was validated against live SiRADIG
- **For import/data fixes**: Include DB query results showing the issue is resolved
