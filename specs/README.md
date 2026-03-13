# Feature Specs

This directory contains acceptance criteria for features. Agents read these specs to understand what to build and validate their work against.

## Format

Each spec is a markdown file with YAML frontmatter:

```markdown
---
title: Feature Name
status: draft | in-progress | implemented
priority: high | medium | low
---

## Summary

One paragraph describing the feature.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes

Any architecture decisions, constraints, or implementation hints.

## Out of Scope

What this feature explicitly does NOT include.
```

## Usage

- Create a spec before starting work: `specs/my-feature.md`
- Reference it when using `/new-feature`: `/new-feature specs/my-feature.md`
- The agent will read the spec and validate against the acceptance criteria
- Mark status as `implemented` when done

## Naming Convention

Use kebab-case: `invoice-bulk-upload.md`, `arca-retry-logic.md`, `simulador-2026-brackets.md`
