---
title: Presentaciones — SiRADIG Form Submissions
status: implemented
priority: high
---

## Summary

Add a "Presentaciones" section to the dashboard where users can view all SiRADIG form submissions (F.572 Web) sent to their employer, import historical submissions from ARCA, and create new submissions that trigger the automation to generate and send the form. Creating a new presentación automates the full flow: navigating to SiRADIG, previewing the form, downloading the PDF (stored in the app), and submitting to the employer. Users can also schedule automatic monthly submissions via a new setting in Configuración, with results visible in the Presentaciones table.

## Acceptance Criteria

### Data model

- [ ] New `Presentacion` model with fields: `id`, `userId`, `fiscalYear`, `numero` (presentación number, e.g. 1–8), `descripcion` (e.g. "Original", "Rectificativa 3"), `fechaEnvio` (submission date), `fechaLectura` (employer read date, nullable), `montoTotal` (total deductions from PDF, `Decimal(12,2)`, nullable), `fileData` (PDF bytes, nullable), `fileMimeType`, `originalFilename`, `source` (enum: `ARCA_IMPORT` | `AUTOMATION`), `siradiqStatus` (reuse existing `SiradiqStatus` enum), `createdAt`, `updatedAt`
- [ ] `Presentacion` belongs to `User` with `onDelete: Cascade`
- [ ] `Presentacion` has optional relation to `AutomationJob` for tracking the submission job
- [ ] `@@unique([userId, fiscalYear, numero])` to prevent duplicates
- [ ] `@@index([userId, fiscalYear])`

### Sidebar navigation

- [ ] New "Presentaciones" nav item appears below "Recibos" and above "Configuración" in the dashboard sidebar
- [ ] Uses an appropriate Lucide icon (e.g. `FileText` or `Send`)
- [ ] Route: `/presentaciones`

### Presentaciones table

- [ ] Server-side paginated table using `usePaginatedFetch` pattern (consistent with Facturas/Recibos)
- [ ] Columns: Nº (presentación number), Descripción (Original/Rectificativa N), Fecha de Envío, Fecha de Lectura (shows "—" when null), Monto Total (formatted as currency, shows "—" when null), SiRADIG (job status badge, same component as Facturas), PDF icon (download link, disabled when no file)
- [ ] Rows sorted by `numero` descending (most recent first)
- [ ] Fiscal year filter defaults to the user's currently selected fiscal year
- [ ] No delete action — presentaciones are immutable once created
- [ ] Row can expand to show job history (same pattern as Facturas/Recibos)

### "Importar desde ARCA" action

- [ ] Page-level button "Importar desde ARCA" triggers a new `PULL_PRESENTACIONES` automation job
- [ ] New `PULL_PRESENTACIONES` job type in `JobType` enum
- [ ] Automation navigates to SiRADIG → "Consulta de Formularios Enviados" for the selected fiscal year
- [ ] Scrapes the table: número, descripción, fecha de envío, fecha de lectura
- [ ] For each row, downloads the PDF via the printer icon dropdown
- [ ] Creates or updates `Presentacion` records (upsert on `userId + fiscalYear + numero`)
- [ ] Stores downloaded PDFs as `fileData` in the database
- [ ] Button shows loading state while job is running; table refreshes on completion

### "Crear nueva Presentación" action

- [ ] Page-level button "Crear nueva Presentación" triggers a new `SUBMIT_PRESENTACION` automation job
- [ ] New `SUBMIT_PRESENTACION` job type in `JobType` enum
- [ ] Automation flow (in order):
  1. Login to ARCA via `arca-navigator`
  2. Enter SiRADIG - Trabajador
  3. Select the person
  4. Select the fiscal year (user's currently selected fiscal year)
  5. Navigate to "Carga de Formulario"
  6. Click "Vista Previa" (bottom right)
  7. Click "Imprimir Borrador" → download PDF, store as `fileData` on the new `Presentacion` record
  8. Click "Enviar a Empleador"
  9. Click "Generar Presentación" to confirm
- [ ] On success, a new `Presentacion` record is created with `source: AUTOMATION`, the PDF, and `siradiqStatus: SUBMITTED`
- [ ] The descripción is determined from the SiRADIG response (Original if first, Rectificativa N otherwise)
- [ ] On failure, `siradiqStatus: FAILED` and error details stored in the automation job logs
- [ ] Use `agent-browser` (via `/arca-assisted-navigation`) during development to observe and record the actual SiRADIG flow before writing the navigator code

### PDF download

- [ ] API route `GET /api/presentaciones/[id]/pdf` returns the stored PDF file
- [ ] Validates that the presentación belongs to the authenticated user
- [ ] Returns 404 if no PDF is available
- [ ] PDF icon in the table links to this endpoint (opens in new tab or triggers download)

### Scheduled submissions (Configuración)

- [ ] New setting in Configuración: "Presentación automática" with a day-of-month selector (1–28) and an enable/disable toggle
- [ ] New fields on `UserPreference`: `autoSubmitDay` (`Int?`, 1–28, nullable = disabled), `autoSubmitEnabled` (`Boolean`, default `false`)
- [ ] Railway cron job runs daily, checks for users whose `autoSubmitDay` matches today's date and `autoSubmitEnabled` is true
- [ ] Cron endpoint: `POST /api/cron/presentaciones` (secured with a `CRON_SECRET` env var)
- [ ] For each matching user, creates a `SUBMIT_PRESENTACION` job for their default fiscal year
- [ ] Result is visible in the Presentaciones table (no email notification in this iteration)

### API routes

- [ ] `GET /api/presentaciones` — list presentaciones for the authenticated user, supports `fiscalYear` filter, pagination (`page`, `pageSize`), returns `{ data, total }`
- [ ] `GET /api/presentaciones/[id]/pdf` — download PDF
- [ ] `POST /api/presentaciones/importar` — triggers `PULL_PRESENTACIONES` job
- [ ] `POST /api/presentaciones/enviar` — triggers `SUBMIT_PRESENTACION` job
- [ ] `GET /api/configuracion` (existing) — extended to return `autoSubmitDay` and `autoSubmitEnabled`
- [ ] `PUT /api/configuracion` (existing) — extended to accept `autoSubmitDay` and `autoSubmitEnabled`
- [ ] `POST /api/cron/presentaciones` — cron endpoint, validates `CRON_SECRET`

## Technical Notes

- **Automation navigators**: New `presentacion-navigator.ts` in `src/lib/automation/` for both pull and submit flows. Use `/arca-assisted-navigation` skill during implementation to observe the real SiRADIG "Consulta de Formularios Enviados" and "Carga de Formulario → Vista Previa → Enviar" flows before writing selectors.
- **Selectors**: Add new selector constants in `selectors.ts` for the "Consulta de Formularios Enviados" table, "Vista Previa" button, "Imprimir Borrador" button, "Enviar a Empleador" button, and "Generar Presentación" confirmation.
- **Job processor**: Extend `job-processor.ts` to handle `PULL_PRESENTACIONES` and `SUBMIT_PRESENTACION` job types.
- **PDF download in automation**: Use Playwright's `page.on('download')` to intercept the PDF download triggered by "Imprimir Borrador". Store the buffer in `Presentacion.fileData`.
- **Railway cron**: Configure in `railway.toml` or Railway dashboard. The cron service calls the API endpoint with `CRON_SECRET` for authentication.
- **UI components**: New `src/components/presentaciones/` directory with `PresentacionesTable`, `PresentacionRow`, and `ScheduleConfig` (for the Configuración card). Follow the same patterns as `src/components/facturas/` and `src/components/recibos/`.
- **Monto total extraction**: Parse the downloaded PDF with `pdf-parse` to extract "Deducciones y desgravaciones" total. If parsing fails, store null — it's not critical.

## Out of Scope

- Email notifications for scheduled submission results (deferred to future iteration)
- Editing or deleting presentaciones
- Viewing the full deduction breakdown within a presentación (users can open the PDF)
- Multi-employer support (assumes single employer per SiRADIG period)
- Presentación approval/rejection tracking from the employer side
- Bulk operations on presentaciones
