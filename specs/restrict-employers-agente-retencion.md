---
title: Restrict Employers to Agente de Retención Only
status: implemented
priority: high
---

## Summary

Users should only be able to add employers that are "agente de retención". Non-agente employers require detailed monthly salary information (remuneración bruta, SAC, deducciones) for each month of the fiscal year, which creates significant friction and complexity. By restricting to agente de retención only, the employer flow stays simple: just CUIT, name, and dates — SiRADIG handles the rest. Imported employers that are not agente de retención are filtered out from the UI and not shown to users.

## Acceptance Criteria

### Data Model & API

- [ ] Remove the `agenteRetencion` toggle from the employer form — the field is always set to `true` when creating or updating an employer via `POST /api/empleadores` and `PUT /api/empleadores/[id]`
- [ ] `GET /api/empleadores?year={year}` only returns employers where `agenteRetencion = true`
- [ ] Existing non-agente employers in the database are excluded from all API responses (filtered at query level)

### UI — Employer Form (Perfil Impositivo + Onboarding)

- [ ] The `agenteRetencion` Switch/toggle is removed from the employer form in `EmployersSection` and the onboarding inline form
- [ ] No user-facing mention of "agente de retención" in the form — the concept is implicit (all employers added through the app are agente de retención)
- [ ] The employer card in the list no longer shows the "Agente de retención" / "No es agente de retención" badge (since all visible employers are agente de retención, the badge is redundant)

### Automation — Import (PULL_EMPLOYERS)

- [ ] `PULL_EMPLOYERS` still imports all employers from SiRADIG into the database (including non-agente), preserving the `agenteRetencion` boolean as extracted from SiRADIG
- [ ] The API filter ensures only agente de retención employers are returned to the UI after import
- [ ] The import summary (e.g., "Se importaron 2 empleadores") only counts agente de retención employers in the user-facing count
- [ ] If all imported employers are non-agente, the UI treats this the same as "no employers found" — showing the add-employer prompt in onboarding, or an empty state in Perfil Impositivo

### Automation — Export (PUSH_EMPLOYERS)

- [ ] `PUSH_EMPLOYERS` continues to set `agenteRetencion = "S"` in SiRADIG since all employers managed through the app are agente de retención
- [ ] The monthly salary amounts dialog logic (lines 803-840 in job-processor.ts) can be removed or left as dead code since `agenteRetencion` will always be `true` — SiRADIG skips that section for agentes de retención

### Edge Cases

- [ ] If a user has only non-agente employers in the DB (from a prior import), the employers list shows empty state as if they have no employers
- [ ] The onboarding no-employers detection counts only agente de retención employers — if only non-agente exist, onboarding still prompts the user to add an employer

## Technical Notes

- **API filter**: Add `agenteRetencion: true` to the Prisma `where` clause in `GET /api/empleadores`. This is the single filtering point — all UI components consume this API.
- **Form changes**: In `employers-section.tsx` (~line 128), remove `agenteRetencion` from the Zod schema's default values and the form fields (~lines 294-299). Hardcode `agenteRetencion: true` in the POST/PUT request body. Same change in `onboarding-step-profile.tsx` (~line 568, ~lines 730-735).
- **Card display**: Remove the agente de retención badge from the employer card rendering in `employers-section.tsx` (~line 731).
- **Import count**: In `job-processor.ts` PULL_EMPLOYERS handler, after upserting, count only `agenteRetencion: true` employers for the success message stored in `resultData`.
- **Onboarding employer count**: In the onboarding state API (`/api/onboarding/state`), the employer count query should filter by `agenteRetencion: true` so the no-employer detection works correctly for users who only have non-agente employers.
- **Dead code cleanup**: The monthly amounts dialog logic in PUSH_EMPLOYERS (~lines 803-840 in job-processor.ts) is now unreachable since all pushed employers have `agenteRetencion = true`. Remove it to keep the code clean.
- **Database**: No schema migration needed — the `agenteRetencion` column stays as-is (boolean with default false). Existing non-agente rows remain in the DB but are filtered out at the API layer.

## Out of Scope

- **Supporting non-agente employers**: Monthly salary amounts entry (remuneración bruta, SAC, deducciones) is excluded — this is the core friction this spec aims to avoid.
- **Migration to delete existing non-agente employers**: They remain in the DB, just hidden from the UI. No data deletion needed.
- **Changing the Prisma schema**: The `agenteRetencion` field and its default remain unchanged.
- **Bulk operations**: No bulk delete of non-agente employers.
