---
title: Spec Writer Skill
status: implemented
priority: medium
---

## Summary

A Claude Code skill (`/write-spec <description>`) that generates well-structured feature specs for the desgrava.ar project. The skill reads `specs/_template.md` as the baseline format, understands the current state of the project (architecture, existing specs, DB schema, available modules), asks clarifying questions when the request is ambiguous, and produces a spec file ready for use with `/new-feature`.

## Acceptance Criteria

- [ ] The skill reads `specs/_template.md` to use as the output format baseline — if the template changes, the skill adapts
- [ ] Before writing, the skill reads `CLAUDE.md` and scans `specs/` to understand existing features, architecture, and naming conventions
- [ ] The skill inspects relevant parts of the codebase (schema, routes, lib modules, components) to ground the spec in the project's current state — e.g., knowing which DB models exist, which API routes are defined, which automation flows are implemented
- [ ] When the user's description is ambiguous or underspecified, the skill asks targeted clarifying questions before generating the spec (e.g., "Should this be a new API route or extend an existing one?", "Which deduction categories should this apply to?")
- [ ] The skill generates a spec file at `specs/<kebab-case-name>.md` with all template sections filled in: Summary, Acceptance Criteria, Technical Notes, and Out of Scope
- [ ] Acceptance criteria are specific and testable — not vague statements like "should work well"
- [ ] Technical Notes reference actual project modules, patterns, and conventions (e.g., "Use `usePaginatedFetch` for the list view", "Add Zod schema in `src/lib/validators/`")
- [ ] Out of Scope is always populated to set clear boundaries on the feature
- [ ] The skill presents the draft spec to the user for review before writing the file, and incorporates feedback if the user requests changes
- [ ] The generated spec follows the naming convention of existing specs (kebab-case, descriptive)

## Technical Notes

The skill should be implemented as a `.claude/skills/write-spec/SKILL.md` file. It should:

1. **Read context first**: `CLAUDE.md`, `specs/_template.md`, `ls specs/`, and optionally `prisma/schema.prisma` and relevant `src/` directories based on the feature description.
2. **Ask before writing**: Present clarifying questions as a numbered list. Wait for answers before proceeding. Skip questions when the description is already clear enough.
3. **Draft and confirm**: Show the full spec content to the user before writing the file. This avoids a write-then-edit cycle.
4. **Use the template literally**: Copy the frontmatter structure and section headings from `_template.md` — don't invent new sections unless the user requests it.

## Out of Scope

- The skill does not implement the feature — it only writes the spec. Use `/new-feature specs/<name>.md` to implement.
- The skill does not manage spec lifecycle (marking specs as implemented, archiving old specs).
- The skill does not generate specs for non-feature work (e.g., refactors, dependency upgrades, CI changes).
