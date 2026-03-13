---
name: new-feature
description: Plan, implement, test, and document a new feature end-to-end. Follows the full agentic workflow — clarifying questions, implementation, tests, validation, and CLAUDE.md updates.
argument-hint: <feature-description-or-spec-file>
---

# New Feature Implementation Workflow

You are implementing a new feature for desgrava.ar, a tax deduction automation platform for Argentine taxpayers.

## Feature Request

$ARGUMENTS

## Phase 1: Plan & Clarify

1. Read `CLAUDE.md` to understand current architecture, patterns, and conventions.
2. If a spec file exists in `specs/` matching this feature, read it for acceptance criteria.
3. Analyze the feature request and identify:
   - Which layers are affected (API, UI, DB, automation, lib)
   - Which existing modules to extend vs. new modules needed
   - What tests are needed
4. **Present a plan to the user** with:
   - Summary of what you'll build
   - Files you'll create or modify
   - Any clarifying questions that would change the approach
5. **Wait for user approval** before proceeding. Ask clarifying questions if the requirements are ambiguous.

## Phase 2: Implement

Once the plan is approved:

1. If database changes are needed:
   - Update `prisma/schema.prisma`
   - Run `npx prisma migrate dev --name <descriptive-name>`
   - Run `npx prisma generate`

2. Implement the feature following these conventions:
   - Business logic in `src/lib/` (organized by domain)
   - API routes in `src/app/api/` (mirror domain structure, validate `session?.user?.id`)
   - UI components in `src/components/` (split by feature domain)
   - Use `Decimal.js` for all monetary calculations
   - Use Zod for all input validation
   - Spanish names only in ARCA/SiRADIG automation code, English everywhere else
   - Follow the Jony Ive design system: clean whites, `border-gray-200`, `bg-gray-50`, generous whitespace
   - **All UI must support dark mode.** The project uses `next-themes` with Tailwind's `dark:` variant (`@custom-variant dark (&:is(.dark *))`). Rules:
     - **Never use raw color classes** like `bg-gray-50`, `bg-white`, `text-gray-600` without a `dark:` counterpart. Prefer semantic tokens (`bg-muted`, `text-muted-foreground`, `bg-card`, `border-border`) which auto-adapt.
     - When semantic tokens aren't sufficient (e.g. success/error states), always pair light and dark variants: `bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400`.
     - Interactive states need dark variants: `hover:bg-accent dark:hover:bg-accent/50`.
     - Semi-transparent overlays work well in dark mode: `dark:bg-input/30`, `dark:border-input`.

3. Run `npm run lint` and `npm run format:check` after implementation. Fix any issues.

## Phase 3: Test

1. Write unit tests for all new business logic in `src/lib/`:
   - Create `__tests__/` directory alongside the module
   - Use Vitest with `describe`/`it` blocks
   - Test happy paths, edge cases, and error conditions
   - Use `@/` path aliases for imports

2. Write tests for new validators (Zod schemas).

3. If the feature includes new API routes, consider integration test patterns.

4. Run the full test suite: `npm run test`
   - ALL tests must pass (existing + new)
   - If a test fails, fix the issue and re-run

## Phase 4: Validate

Run the full CI check locally:

```bash
npm run lint && npm run format:check && npm run build && npm run test
```

All four commands must pass. If any fail, fix and re-run.

## Phase 5: Document & Codify

1. **Update `CLAUDE.md`** if the feature introduces:
   - New route groups or API routes
   - New domain directories in `src/lib/` or `src/components/`
   - New patterns or conventions
   - New environment variables
   - New database models

2. **Create or update a spec** in `specs/` if acceptance criteria were defined.

3. Mark the spec as implemented with a `status: implemented` field.

## Phase 6: Summary

Present a summary:

- What was implemented (files created/modified)
- Test coverage added
- Any decisions made and why
- Suggestions for follow-up work
