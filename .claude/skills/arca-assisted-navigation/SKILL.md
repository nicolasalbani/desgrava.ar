---
name: arca-assisted-navigation
description: >-
  Assisted browser navigation for ARCA/SiRADIG automation. Opens a headed browser for the developer
  to demonstrate a flow, records every interaction, then generates Playwright automation code, tests,
  and documentation. Use this skill whenever you need to implement a new ARCA/SiRADIG navigation flow
  or fix a broken one — do NOT guess selectors or page structure, always observe first.
allowed-tools: Bash(npx agent-browser:*), Bash(agent-browser:*)
argument-hint: <description of the flow to record, e.g. "navigate to Mis Comprobantes and download last 12 months">
---

# ARCA Assisted Navigation

You are recording a real ARCA/SiRADIG browsing session so you can generate Playwright automation code
that matches the existing patterns in `src/lib/automation/`.

**When to auto-trigger this skill** (even without explicit `/arca-assisted-navigation`):

- You are asked to implement a new ARCA or SiRADIG automation flow
- You are asked to fix a broken navigation flow and need to see the current page structure
- You need to discover selectors, page transitions, or form behavior on ARCA/SiRADIG

## Flow being recorded

$ARGUMENTS

---

## Phase 1: Launch Browser & Authenticate

1. Open a **headed** browser session at the ARCA login page:

```bash
agent-browser --headed --session arca-assisted open https://auth.afip.gob.ar/contribuyente_/login.xhtml
```

2. Tell the user: **"Browser is open. Please log in with your ARCA credentials. Let me know when you're on the page where the flow starts."**

3. While the user logs in, take periodic snapshots to understand the login flow:

```bash
agent-browser snapshot -i
agent-browser screenshot --annotate
```

4. After the user confirms they are ready, take a **baseline snapshot and screenshot**:

```bash
agent-browser snapshot -i && agent-browser screenshot --annotate
agent-browser get url
```

5. Save the browser state so future replays can skip login:

```bash
agent-browser state save .automation-data/arca-auth-state.json
```

---

## Phase 2: Record User Navigation

For each flow the user wants to record, repeat this loop. Multiple flows can be recorded in a single session.

### Recording Loop

**Before each user action**, capture the current state:

```bash
agent-browser snapshot -i
agent-browser screenshot --annotate
agent-browser get url
```

Ask the user: **"What action should I perform next?"** or **"Please describe what you're clicking/filling."**

**After each user action**, immediately:

1. Wait for the page to settle:

```bash
agent-browser wait --load networkidle
```

2. Capture the resulting state:

```bash
agent-browser snapshot -i
agent-browser screenshot --annotate
agent-browser get url
```

3. Record the step in your internal step log with this structure:
   - **Step number**
   - **Action type**: click, fill, select, navigate, wait, scroll
   - **Target**: element ref (`@eN`), CSS selector, or text content used to locate the element
   - **Value** (for fill/select): the text or option entered
   - **URL before** and **URL after**
   - **Notable DOM changes**: new elements, modals, tabs, redirects

4. If a **new tab or popup** opened, switch to it:

```bash
agent-browser snapshot -i
```

5. If the action **failed or produced an error**, take a screenshot and ask the user for guidance.

### Pagination Detection

When you observe the user interacting with items in a **list or table** that has pagination controls (next/prev buttons, page numbers), record:

- The selector for individual list items
- The selector for the "next page" / pagination control
- The action performed on each item

Mark this in the step log as a **paginated action** — the generated code must loop through all pages.

### Flow Boundary

When the user says the flow is complete, or navigates away from the target area:

1. Take a final snapshot and screenshot
2. Summarize the recorded steps back to the user for confirmation
3. Ask: **"Is this flow complete? Should we record another flow in this session?"**

---

## Phase 3: Generate Automation Code

After all flows are recorded, generate Playwright code following the existing patterns exactly.

### Code Generation Rules

1. **Study existing navigators first** — read these files to match their style:
   - `src/lib/automation/arca-navigator.ts` — login and portal navigation
   - `src/lib/automation/siradig-navigator.ts` — SiRADIG form filling
   - `src/lib/automation/selectors.ts` — centralized selector constants
   - `src/lib/automation/deduction-mapper.ts` — enum-to-UI mappings

2. **Selectors go in `selectors.ts`** — add new selector constants to `ARCA_SELECTORS` or create a new
   section. Never hardcode selectors in navigator functions.

3. **Navigator function signature** must follow:

```typescript
export async function newFlowName(
  page: Page,
  // ... flow-specific params
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<ResultType> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  // ...
}
```

4. **Spanish log messages** in all ARCA/SiRADIG automation code (matching existing convention).

5. **Wait patterns**:
   - `await page.waitForLoadState("networkidle")` after every navigation or form submission
   - `await page.waitForTimeout(N)` only when AJAX/animation delays are observed
   - `locator.waitFor({ timeout: 30000 })` before interacting with elements that load asynchronously

6. **Screenshot capture** at every meaningful step using the `capture()` callback with a descriptive slug and Spanish label.

7. **Paginated actions** must use a while-loop:

```typescript
while (true) {
  // Process items on current page
  const items = page.locator(SELECTORS.itemSelector);
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    // ... action on each item
  }
  // Check for next page
  const nextBtn = page.locator(SELECTORS.nextPageButton);
  if (await nextBtn.isVisible()) {
    await nextBtn.click();
    await page.waitForLoadState("networkidle");
  } else {
    break;
  }
}
```

8. **Error handling** — wrap the flow in try/catch, return a typed result object with `success` and `error` fields.

9. **If a mapper is needed** (enum ↔ UI string), add it to `deduction-mapper.ts` or create a new mapper file following the same pattern.

### File Placement

| What                    | Where                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| New navigator functions | `src/lib/automation/<flow-name>-navigator.ts` or extend existing navigator |
| New selectors           | `src/lib/automation/selectors.ts` (add to `ARCA_SELECTORS`)                |
| New mappers             | `src/lib/automation/<domain>-mapper.ts`                                    |
| New types/interfaces    | In the navigator file or a shared types file                               |

---

## Phase 4: Verify with agent-browser

Before writing tests, replay the generated flow using agent-browser to verify it works:

1. Load the saved auth state:

```bash
agent-browser --headed --session arca-verify state load .automation-data/arca-auth-state.json
```

2. Step through the generated code manually via agent-browser commands, comparing each step's result
   against the recorded snapshots.

3. If a step fails:
   - Take a snapshot to see the current DOM
   - Compare with the recorded snapshot
   - Adjust selectors or wait logic
   - Re-verify from the failing step

4. Once the full flow replays successfully, proceed to tests.

---

## Phase 5: Write Tests

Create tests for all new code in `__tests__/` directories alongside the modules.

### What to test

- **Selector constants**: verify they exist and are non-empty strings
- **Mapper functions**: test all enum-to-string and string-to-enum mappings (use `it.each`)
- **Helper/utility functions**: test pagination detection, date formatting, etc.
- **Data integrity**: all map keys are consistent across related maps

### Test patterns (match existing style)

```typescript
import { describe, it, expect } from "vitest";

describe("newFlowSelectors", () => {
  it.each(Object.entries(NEW_SELECTORS))("selector %s is a non-empty string", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });
});
```

Run the full test suite:

```bash
npm run test
```

---

## Phase 6: Validate

Run the full CI check:

```bash
npm run lint && npm run format:check && npm run build && npm run test
```

All four must pass. Fix any issues and re-run.

---

## Phase 7: Document

1. **Update `src/lib/automation/selectors.ts`** — add human-readable descriptions to `SELECTOR_DESCRIPTIONS` for any new selectors.

2. **Update `CLAUDE.md`** if the feature introduces new modules, patterns, or conventions.

3. **Document the flow** — add a brief comment block at the top of the new navigator function describing:
   - What the flow does
   - The sequence of pages/steps
   - Any known gotchas (CAPTCHA, AJAX delays, jQuery quirks)

---

## Phase 8: Summary

Present to the user:

- Recorded steps and what was observed
- Files created or modified
- Tests added
- Any selectors or behaviors that may be fragile and need monitoring
- Suggestions for follow-up (e.g., adding the flow to the job processor)

---

## Recovery: When You Can't Reproduce a Step

If you cannot autonomously reproduce a user's navigation step:

1. Take a snapshot and screenshot of the current state
2. Show the user what you see and explain what you expected
3. Ask: **"Can you guide me through this step? What should I click/fill next?"**
4. Record the user's guidance and incorporate it into the generated code with a comment explaining the non-obvious behavior

Never guess or hardcode selectors you haven't verified through a snapshot. Always observe first.
