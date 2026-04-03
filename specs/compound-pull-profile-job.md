---
title: Compound PULL_PROFILE Automation Job
status: implemented
priority: high
---

## Summary

Create a new compound automation job type (`PULL_PROFILE`) that imports all "Perfil Impositivo" data from ARCA in a single browser session: personal data, employers, family dependents, and domestic workers. Currently each import runs as a separate job with its own ARCA login and service navigation, meaning 4 logins and 3 SiRADIG opens. The compound job logs in once, opens SiRADIG once, extracts all three SiRADIG sections sequentially, then opens Casas Particulares for domestic workers — saving ~40-60 seconds of duplicated navigation. This job is designed to run automatically after ARCA credential validation during onboarding.

## Acceptance Criteria

- [ ] New `PULL_PROFILE` value added to `JobType` enum in Prisma schema (with migration)
- [ ] `PULL_PROFILE` job processor logs into ARCA exactly once and opens SiRADIG exactly once
- [ ] Within the single SiRADIG session, extracts: personal data (Datos Personales), employers (Empleadores), and family dependents (Cargas de Familia) — in that order
- [ ] After SiRADIG extraction, returns to the portal page and opens "Personal de Casas Particulares" to pull domestic workers
- [ ] Each sub-task (personal data, employers, family dependents, domestic workers) upserts data using the same DB logic as the existing individual pull jobs
- [ ] Job steps shown to the user reflect the compound flow: login → SiRADIG → datos personales → empleadores → cargas de familia → casas particulares → done
- [ ] If one sub-task fails (e.g., no employers found), the job continues with the remaining sub-tasks and reports partial results — it does NOT abort the entire job
- [ ] Job status is COMPLETED if all sub-tasks succeed, FAILED only if a critical step fails (login or SiRADIG navigation)
- [ ] Job logs include per-sub-task results summary (e.g., "3 empleadores importados, 2 cargas de familia importadas, 1 trabajador importado")
- [ ] API route `POST /api/automatizacion` accepts `jobType: "PULL_PROFILE"` and creates the compound job
- [ ] After successful ARCA credential validation (`VALIDATE_CREDENTIALS` job completes), a `PULL_PROFILE` job is automatically created and started
- [ ] Perfil Impositivo page shows a single "Importar todo desde ARCA" button that triggers `PULL_PROFILE` (in addition to keeping existing individual import buttons)
- [ ] The "Importar todo desde ARCA" button is mobile-friendly (full-width on mobile, min 44px touch target)
- [ ] While `PULL_PROFILE` is running, individual import buttons on each sub-section are disabled
- [ ] All existing individual pull jobs (`PULL_PERSONAL_DATA`, `PULL_EMPLOYERS`, `PULL_FAMILY_DEPENDENTS`, `PULL_DOMESTIC_WORKERS`) continue to work independently
- [ ] All existing tests pass; new tests cover job step definitions and the compound flow routing

## Technical Notes

- **New enum value**: Add `PULL_PROFILE` to `JobType` in `prisma/schema.prisma`. Run migration.
- **Job steps** (`src/lib/automation/job-steps.ts`): Define steps for `PULL_PROFILE`: `login` → `siradig` → `datos_personales` → `empleadores` → `cargas_familia` → `casas_particulares` → `done`. These are new granular steps that give users visibility into compound job progress.
- **Job processor** (`src/lib/automation/job-processor.ts`): New `processPullProfile()` function. The optimized flow:
  1. `loginToArca()` — single login
  2. `navigateToSiradig()` → `navigateToSiradigMainMenu()` — single SiRADIG open
  3. Extract personal data (reuse logic from `processPullPersonalData`, but pass existing `siradigPage`)
  4. Navigate back to main menu, extract employers (reuse logic from `processPullEmployers`)
  5. Navigate to deduction section, extract family dependents (reuse logic from `processPullFamilyDependents`)
  6. Close SiRADIG tab, return to portal page
  7. `searchAndOpenService()` for "Personal de Casas Particulares" → extract domestic workers (reuse `pullDomesticWorkersOnly()`)
- **Reuse extraction logic**: Factor out the data extraction portions of the existing pull processors into standalone functions that accept a `siradigPage` parameter, rather than duplicating code. The existing individual pull jobs should call these same extracted functions.
- **Error resilience**: Wrap each sub-task in try/catch. Log failures per sub-task but continue. Set final job status to COMPLETED if at least login + SiRADIG succeeded (even if some sub-tasks had no data). Set FAILED only if login or SiRADIG navigation fails.
- **Auto-trigger after credential validation**: In the `VALIDATE_CREDENTIALS` completion handler in `job-processor.ts`, create a `PULL_PROFILE` job if the credential validation succeeded.
- **UI**: Add an "Importar todo desde ARCA" button at the top of the perfil page (`src/app/(dashboard)/perfil/page.tsx`). Use the same `ImportArcaDialog` pattern. Disable individual section import buttons while a `PULL_PROFILE` job is running by checking for active `PULL_PROFILE` jobs. Each sub-section should refresh its data when the compound job completes (poll job status as usual).
- **SiRADIG navigation within session**: After extracting personal data, navigating back to the main menu is straightforward (click "Volver" or navigate to main menu). After employers, navigate to deduction section for family dependents. The key optimization is avoiding re-login and re-opening SiRADIG.

## Out of Scope

- Pulling comprobantes (invoices from "Mis Comprobantes") — this is a separate heavy operation with CSV download.
- Pulling domestic worker receipts — these are imported from the Recibos page, not Perfil.
- Pulling presentaciones — separate concern.
- Modifying the onboarding flow UI beyond auto-triggering the job after credential validation.
- Push operations (PUSH_FAMILY_DEPENDENTS, PUSH_EMPLOYERS) — these are write operations, not imports.
