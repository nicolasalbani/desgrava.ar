---
title: Employers Section in Perfil Impositivo
status: implemented
priority: high
---

## Summary

Add an "Empleadores" (Employers) section to the "Perfil impositivo" page, positioned above the existing "Cargas de Familia" section. This allows users to manage their employers for the selected fiscal year — adding, editing, deleting, importing from SiRADIG, and exporting individual employers to SiRADIG. The section mirrors the Cargas de Familia UI and interaction patterns (CRUD, per-row export, bulk import via automation jobs).

## Acceptance Criteria

### Data Model

- [ ] New `Employer` Prisma model with fields: `id`, `userId`, `fiscalYear`, `cuit` (11 digits), `razonSocial`, `fechaInicio` (DD/MM/YYYY string), `fechaFin` (DD/MM/YYYY string, nullable), `agenteRetencion` (boolean), timestamps
- [ ] Indexed on `[userId, fiscalYear]`
- [ ] Relation to `User` (cascade delete) and `AutomationJob`
- [ ] Migration created and applied

### API

- [ ] `GET /api/empleadores?year={year}` — List employers for user+year
- [ ] `POST /api/empleadores` — Create employer (validates CUIT format, requires `fiscalYear`)
- [ ] `PUT /api/empleadores/[id]` — Update employer (ownership check)
- [ ] `DELETE /api/empleadores/[id]` — Delete employer (ownership check)
- [ ] All routes protected via `getServerSession`

### UI — Employers Section

- [ ] New `EmployersSection` component in `src/components/perfil/`
- [ ] Positioned above Cargas de Familia on the Perfil page
- [ ] Shows a card-based list of employers with: CUIT (formatted), Razon Social, Fecha Inicio, Fecha Fin (or "Actual"), Agente de Retencion (Si/No badge)
- [ ] "Agregar empleador" button opens a form dialog
- [ ] "Importar desde SiRADIG" button triggers a PULL_EMPLOYERS automation job with SSE progress tracking
- [ ] Per-row actions: Export to SiRADIG (Upload icon), Edit (Pencil icon), Delete (Trash icon with confirmation dialog)
- [ ] Export per-row follows the same SSE pattern as Cargas de Familia (blue pulsing during export, green on success, red on failure)
- [ ] Import highlights new/updated rows (green/blue badges, 3s auto-fade)
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

### UI — Form Dialog

- [ ] CUIT field with format validation (11 digits)
- [ ] Razon Social field (text input, user-entered — no AJAX lookup needed since desgrava.ar is not connected to ARCA's employer registry)
- [ ] Fecha Inicio (date input, required)
- [ ] Fecha Fin (date input, optional — blank means currently employed)
- [ ] Agente de Retencion (toggle/checkbox, default: No)
- [ ] Zod schema validation

### Automation — Import (PULL_EMPLOYERS)

- [ ] New `PULL_EMPLOYERS` job type in `JobType` enum
- [ ] Job steps: login → siradig → extract → done
- [ ] Navigate to SiRADIG Empleadores section, extract all employer rows from the table
- [ ] For each employer, click edit to read form fields (CUIT, razonSocial, fechaInicioRelacion, fechaFinRelacion, agenteRetencion)
- [ ] Upsert into DB: match by `userId + fiscalYear + cuit`, create or update
- [ ] Add selectors for the Empleadores section in `ARCA_SELECTORS`

### Automation — Export (PUSH_EMPLOYERS)

- [ ] New `PUSH_EMPLOYERS` job type in `JobType` enum
- [ ] Job steps: login → siradig → upload → done
- [ ] Navigate to SiRADIG Empleadores section
- [ ] Check if employer already exists in table (match by CUIT)
- [ ] If exists: click edit, update fields, save
- [ ] If new: click "Nuevo Empleador", select "Otro (ingresar)", fill CUIT (triggers razonSocial lookup), fill dates and agenteRetencion, save
- [ ] Store `employerId` on the AutomationJob for per-employer tracking

### Job API

- [ ] `/api/automatizacion` accepts `PULL_EMPLOYERS` (requires `fiscalYear`) and `PUSH_EMPLOYERS` (requires `fiscalYear` + `employerId`)
- [ ] Concurrent push job prevention per employer (same as family dependents)

## Technical Notes

- Follow the exact patterns from `FamilyDependent` / `family-dependents.tsx`: state management, SSE via `EventSource`, per-row export with `exportingId`/`exportResults`, import with `connectToJobSSE`, active job recovery on mount, highlight animations.
- SiRADIG Empleadores table uses `data-id-reg` attribute on rows and `.act_editar` for edit buttons — same pattern as Cargas de Familia.
- Form fields in SiRADIG: `#cuit` (text, readonly when editing existing), `#razonSocial` (readonly, auto-populated), `#fechaInicioRelacion` (date DD/MM/YYYY), `#fechaFinRelacion` (date DD/MM/YYYY), `#agenteRetencion` (select: "S"/"N").
- New employer form has `#idEmpleadores` dropdown with existing employers + "Otro (ingresar)" option (value "99") for manual CUIT entry. When "Otro" is selected, `#cuit` becomes editable.
- The CUIT field triggers an AJAX lookup to populate `#razonSocial` (business name).
- Add `PULL_EMPLOYERS` and `PUSH_EMPLOYERS` to `JOB_TYPE_STEPS` in `job-steps.ts`.
- Add `employerId` optional relation on `AutomationJob` (like `familyDependentId`).
- Navigation to Empleadores uses the "Empleadores" tab link in SiRADIG's main navigation.
- Mobile: design for 320px first, card layout for employer list, full-width dialogs, 44px touch targets.

## Out of Scope

- **Monthly amounts (Detalle de Importes Mensuales)**: The SiRADIG employer form has a complex monthly salary breakdown table (~20 columns x 12 months). This is excluded from the initial implementation — only the employer header fields (CUIT, name, dates, retention agent) are managed.
- **Convenio colectivo de trabajo**: Read-only field in SiRADIG, not user-editable.
- **Employer CUIT validation against ARCA registry**: No live AJAX lookup of employer CUIT from desgrava.ar — user enters name manually.
- **Bulk export**: No "export all employers" button — only per-row export.
- **Employer-linked invoice filtering**: No association between employers and invoices.
