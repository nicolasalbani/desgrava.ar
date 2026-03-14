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

## CRITICAL: agent-browser + ARCA Gotchas

These are hard-won lessons from real testing. Follow them exactly.

1. **Login redirects break page context.** After ARCA login, the browser redirects across domains
   (auth.afip.gob.ar → portalcf.cloud.afip.gob.ar). agent-browser loses track of the page.
   **Fix:** After login completes, run `agent-browser open <portal-url>` to re-establish context.
   The cookies persist, so the portal loads authenticated.

2. **ARCA portal is an SPA.** The portal renders via JavaScript after page load. `snapshot -i` may
   show very few interactive elements even though the page is fully rendered visually. Use
   `screenshot --annotate` alongside snapshots — the annotated screenshot labels visible elements
   with refs you can use.

3. **`networkidle` hangs on ARCA login pages** due to persistent connections. Use timed waits
   (`wait 3000`) for login steps. `networkidle` is fine for the portal and SiRADIG (SPAs with
   finite AJAX).

4. **New tabs/popups** (e.g., SiRADIG opens in a new tab): use `tab list` to find it and `tab <N>`
   to switch. Then `open <url>` if context is lost.

---

## Phase 1: Automated Login

The skill logs in automatically using credentials from `.env`. No user intervention needed.

1. Read credentials from `.env`:

```bash
grep ARCA_AGENT_USERNAME .env | cut -d= -f2
grep ARCA_AGENT_PASSWORD .env | cut -d= -f2
```

2. Kill any stale sessions and launch a fresh headed browser:

```bash
pkill -f agent-browser 2>/dev/null; sleep 2
agent-browser --headed --session arca-assisted open https://auth.afip.gob.ar/contribuyente_/login.xhtml
```

3. Snapshot the login page, fill CUIT, and click Siguiente:

```bash
agent-browser --session arca-assisted snapshot -i
agent-browser --session arca-assisted fill @e2 "<CUIT>"
agent-browser --session arca-assisted click @e3
```

Note: `@e2` is the CUIT spinbutton, `@e3` is the "Siguiente" button. Verify refs from the snapshot
before acting — the login page is stable but refs can shift.

4. Wait for the password page and fill it:

```bash
agent-browser --session arca-assisted wait 3000
agent-browser --session arca-assisted snapshot -i
agent-browser --session arca-assisted fill @e2 "<PASSWORD>"
agent-browser --session arca-assisted click @e4
```

Note: `@e2` is the "TU CLAVE" textbox, `@e4` is the "Ingresar" button on the password page.

5. Wait for login redirect, then **re-establish page context** by navigating to the portal directly:

```bash
agent-browser --session arca-assisted wait 5000
agent-browser --session arca-assisted get url
```

If the URL shows the portal (`portalcf.cloud.afip.gob.ar`), the login worked but page context is
likely lost. Fix it:

```bash
agent-browser --session arca-assisted open https://portalcf.cloud.afip.gob.ar/portal/app/
agent-browser --session arca-assisted wait 3000
```

6. Verify login succeeded with a screenshot:

```bash
agent-browser --session arca-assisted screenshot --annotate
agent-browser --session arca-assisted snapshot -i
```

The annotated screenshot should show the ARCA portal with services like "Mis Comprobantes",
"SiRADIG - Trabajador", etc.

**If login fails** (CAPTCHA, wrong credentials, error message), take a screenshot and tell the user:
**"Login failed: [reason]. Please check ARCA_AGENT_USERNAME and ARCA_AGENT_PASSWORD in .env."**

---

## Phase 2: Agent-Driven Navigation (User Directs, Agent Executes)

The user describes what to do at each step. **You execute it via agent-browser CLI commands.**
This ensures agent-browser always tracks the page correctly.

### Recording Loop

1. **Capture current state** (screenshot + snapshot + URL):

```bash
agent-browser --session arca-assisted get url
agent-browser --session arca-assisted screenshot --annotate
agent-browser --session arca-assisted snapshot -i
```

2. **Show the user** the annotated screenshot and ask: **"What should I do next?"**
   (e.g., "click the search box", "type Mis Comprobantes", "click the first result")

3. **Execute the action** via the appropriate agent-browser command:

```bash
# Click by element ref from snapshot
agent-browser --session arca-assisted click @e5

# Fill a text input
agent-browser --session arca-assisted fill @e3 "Mis Comprobantes"

# Type with keyboard (when fill doesn't work on SPAs)
agent-browser --session arca-assisted type @e3 "Mis Comprobantes"

# Press a key
agent-browser --session arca-assisted press Enter

# Select a dropdown option
agent-browser --session arca-assisted select @e7 "2025"

# Scroll
agent-browser --session arca-assisted scroll down 300

# Navigate to a URL directly
agent-browser --session arca-assisted open https://some.url
```

4. **Wait for the page to settle** after each action:

```bash
agent-browser --session arca-assisted wait 3000
```

Or for pages where networkidle works (SPA content after initial load):

```bash
agent-browser --session arca-assisted wait --load networkidle
```

5. **Handle new tabs/popups**: After clicking a link that may open a new tab:

```bash
agent-browser --session arca-assisted tab list
```

If a new tab appeared, switch to it:

```bash
agent-browser --session arca-assisted tab <N>
```

If context is lost on the new tab, navigate directly:

```bash
agent-browser --session arca-assisted open <url-from-tab-list>
```

6. **Capture the resulting state**:

```bash
agent-browser --session arca-assisted get url
agent-browser --session arca-assisted screenshot --annotate
agent-browser --session arca-assisted snapshot -i
```

7. **Record the step** in your internal step log:
   - **Step number**
   - **Action type**: click, fill, select, navigate, wait, scroll
   - **Target**: element ref (`@eN`) and the CSS selector / text content from the snapshot
   - **Value** (for fill/select): the text or option entered
   - **URL before** and **URL after**
   - **Notable DOM changes**: new elements, modals, tabs, redirects
   - **Actual CSS selectors**: extract real CSS selectors for elements interacted with (use
     `agent-browser eval "document.querySelector('...').outerHTML"` to inspect elements)

8. Repeat from step 1 until the user says the flow is complete.

### Downloading Files

When the flow involves downloading a file (e.g., CSV export):

```bash
agent-browser --session arca-assisted download @eN .automation-data/downloaded-file.csv
```

After downloading, **read the file** to understand its format:

```bash
head -5 .automation-data/downloaded-file.csv
```

Record the exact column headers and data format — this is critical for writing parsers.

### Extracting Real CSS Selectors

During recording, extract actual selectors for important elements:

```bash
# Get the HTML of an element by ref
agent-browser --session arca-assisted get html @e5

# Get specific attributes
agent-browser --session arca-assisted get attr id @e5
agent-browser --session arca-assisted get attr class @e5

# Run JS to find selectors
agent-browser --session arca-assisted eval "document.querySelector('#someId').tagName"
```

### Pagination Detection

When you observe a table with pagination controls in the snapshot:

- Record the selector for individual list items/rows
- Record the selector for the "next page" / pagination control
- Record the action performed on each item

Mark this in the step log as a **paginated action** — the generated code must loop through all pages.

### Flow Boundary

When the user says the flow is complete:

1. Take a final snapshot and screenshot
2. Summarize ALL recorded steps back to the user for confirmation
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
   section. Never hardcode selectors in navigator functions. Use the **real CSS selectors** you
   observed during recording, NOT guesses.

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

1. Re-login using the same Phase 1 procedure.

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

## Recovery: When You Can't See the Right Page

If snapshots show empty content or the wrong page after an action:

1. **Check the URL** — it may report correctly even if context is lost:

```bash
agent-browser --session arca-assisted get url
```

2. **Re-establish context** by navigating directly to the URL:

```bash
agent-browser --session arca-assisted open <the-url>
agent-browser --session arca-assisted wait 3000
```

3. **List tabs** if a popup or new tab opened:

```bash
agent-browser --session arca-assisted tab list
agent-browser --session arca-assisted tab <N>
```

4. If still stuck, ask the user: **"I can't find the right page. Can you tell me what URL you see
   in the browser?"** Then navigate directly.

## Recovery: When an Action Fails

If a click/fill command fails or produces unexpected results:

1. Take a screenshot and snapshot of the current state
2. Show the user what you see and explain what you tried
3. Ask: **"This didn't work as expected. What should I try instead?"**
4. Try alternative approaches:
   - Use `find` commands: `agent-browser --session arca-assisted find text "Button Text" click`
   - Use JavaScript eval: `agent-browser --session arca-assisted eval "document.querySelector('#id').click()"`
   - Use keyboard navigation: `agent-browser --session arca-assisted press Tab` then `press Enter`

Never guess or hardcode selectors you haven't verified through a snapshot. Always observe first.
