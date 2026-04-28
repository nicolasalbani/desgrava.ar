---
name: write-spec
description: Generate a well-structured feature spec grounded in the current project state. Reads the template, understands architecture, asks clarifying questions, and writes the spec file.
argument-hint: <feature-description>
---

# Spec Writer

You are writing a feature spec for desgrava.ar. Your goal is to produce a clear, actionable spec that can be handed to `/new-feature` for implementation.

## Input

$ARGUMENTS

## Phase 1: Understand Context

Before writing anything, gather context:

1. **Read the template**: Read `specs/_template.md` to get the exact output format (frontmatter fields, section headings). Your spec MUST follow this structure — do not invent new sections unless the user asks.
2. **Read project docs**: Read `CLAUDE.md` to understand architecture, tech stack, patterns, and conventions.
3. **Scan existing specs**: Run `ls specs/` to see what features already exist. Read any specs that seem related to the requested feature to avoid overlap and maintain consistency in style and detail level.
4. **Inspect relevant code**: Based on the feature description, selectively read parts of the codebase that are relevant:
   - `prisma/schema.prisma` — if the feature likely needs DB changes
   - `src/app/api/` — if it involves API routes
   - `src/lib/` — if it involves business logic
   - `src/components/` — if it involves UI
   - `src/lib/automation/` — if it involves ARCA/SiRADIG automation

   Don't read everything — focus on what's relevant to the feature.

## Phase 1.5: Consult Domain Knowledge (Lenny's MCP)

Before clarifying with the user, decide whether the feature description has a product, marketing, or pricing dimension. If so, query Lenny Rachitsky's MCP server to ground the spec in proven frameworks; if not, skip the MCP entirely so you don't waste calls.

**Trigger keywords** (case-insensitive substring match on the user's request):

`product`, `onboarding`, `activation`, `retention`, `churn`, `engagement`, `pricing`, `monetization`, `paywall`, `trial`, `subscription`, `positioning`, `messaging`, `copy`, `landing`, `growth`, `acquisition`, `funnel`, `conversion`, `marketing`, `channel`, `referral`, `virality`, `launch`, `PMF`, `ICP`, `persona`, `segment`

If none of these appear, **explicitly note in your working summary that the MCP was skipped** (e.g., "Lenny MCP skipped — pure technical work") and continue to Phase 2.

**When triggered:**

1. **Discover tools at runtime** — list the available `mcp__lennys-data__*` tools at session start. Do NOT hardcode tool names; Lenny's catalog evolves. Pick the tools whose descriptions best match the request shape (e.g., onboarding tools for activation work, channels tools for acquisition work).

2. **Pin product context** in every query so Lenny's frameworks come back translated for our reality. Always include this context block:

   > B2C SaaS for Argentine taxpayers (ARCA / SiRADIG tax deduction automation), Spanish-only UI, currently zero paying users (just family beta-testing), goal of first 1000 users. 30-day free trial, then MercadoPago monthly/annual subscription. Target geography: Argentina only. Channels available: LinkedIn AR, Instagram AR, Twitter/X AR, WhatsApp groups, contadores (accountant) referrals.

3. **Translate to Argentine context** — Lenny's content is largely US/global. When citing a framework, adapt it: ARS pricing, Spanish messaging, ARCA regulatory constraints, Argentine channels. Don't surface raw US examples without translation.

4. **Cite inline** — every Acceptance Criteria item or Technical Note that came from a Lenny query gets a short trailing citation: `[Lenny: <framework or resource>]`. Keep it lightweight — traceability, not academic citation. Example: `- [ ] Show the activation milestone within 60 seconds of first login [Lenny: Sean Ellis activation framework]`.

**Failure handling — never block the spec:**

- **Server returns 401 / unauthenticated**: log one line ("Lenny MCP unauthenticated — skipped"), tell the user once at the end that they may want to OAuth in next time, and proceed without MCP input.
- **Network timeout / unreachable**: log one line ("Lenny MCP unreachable — skipped") and proceed.
- **Empty tool list**: log one line ("Lenny MCP returned no tools — skipped") and proceed.

In all three cases write the spec using only the template + project context. No retry loops.

## Phase 2: Clarify

Evaluate whether the feature description is clear enough to write a good spec. If any of the following are ambiguous, **ask the user before proceeding**:

- **Scope**: What's included vs. excluded? (e.g., "Should this cover both facturas and recibos?")
- **User flow**: How does the user interact with this? (e.g., "Is this a new page, a modal, or an addition to an existing view?")
- **Data model**: Does this need new DB tables/fields? (e.g., "Should we store this per-user or globally?")
- **Edge cases**: Any special handling needed? (e.g., "What happens if the CUIT doesn't exist in the catalog?")
- **Integration**: How does this connect to existing features? (e.g., "Should this trigger automatically after invoice upload?")

**Rules for questions:**

- Ask only what you genuinely need — don't ask for the sake of asking.
- Present questions as a numbered list for easy answering.
- If the description is already clear and complete, skip this phase and say so.
- Wait for the user's answers before proceeding to Phase 3.

## Phase 3: Draft & Confirm

1. **Draft the spec** following the template format exactly:
   - `title`: Short, descriptive feature name
   - `status: draft`
   - `priority`: Infer from context (high/medium/low), or ask if unclear
   - **Summary**: One paragraph — what it does and why it's needed. Reference the user's problem, not implementation details.
   - **Acceptance Criteria**: Specific, testable checklist items. Each criterion should be verifiable by looking at the code or running the app. Bad: "should work well". Good: "API returns paginated results with `total` count and `page`/`pageSize` parameters". **If the feature includes UI**, always add a criterion for mobile responsiveness (e.g., "All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout").
   - **Technical Notes**: Reference actual project modules, patterns, and conventions. Mention specific files, libraries, or patterns from `CLAUDE.md` that apply. Include architecture decisions or constraints. **If the feature includes UI**, note the mobile-first requirement: design for 320px first, enhance with `sm:`/`md:`/`lg:` breakpoints, full-width modals/sheets on mobile, card layouts or horizontal scroll for tables on mobile, 44px minimum touch targets.
   - **Out of Scope**: Always populated. Explicitly list what this feature does NOT include to prevent scope creep.

2. **Present the full spec** to the user in a code block for review.

3. **Wait for confirmation** or feedback. If the user requests changes, incorporate them and re-present.

## Phase 4: Write

Once the user confirms:

1. Derive the filename from the title using kebab-case (e.g., "Bulk Edit Category" → `bulk-edit-category.md`).
2. Write the spec to `specs/<filename>.md`.
3. Report the file path so the user can reference it with `/new-feature specs/<filename>.md`.
