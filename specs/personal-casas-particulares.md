---
title: Personal de Casas Particulares — Trabajadores a cargo, Recibos e integración SiRADIG
status: implemented
priority: high
---

## Summary

Add full support for "Personal de Casas Particulares" (domestic workers) within desgrava.ar. This includes a "Trabajadores a cargo" section under "Perfil Impositivo" for managing workers, a new "Recibos" section (parallel to Facturas) for salary receipts, automated import of receipts from ARCA's "Personal de Casas Particulares" service, and the ability to submit receipts to SiRADIG under the "Deducción del personal doméstico" category.

## Domain Model

### Trabajador (DomesticWorker)

Fields derived from ARCA's "Personal de Casas Particulares > Datos del Trabajador":

| Field                 | Type    | Description                                   | Example                                                                                    |
| --------------------- | ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `cuil`                | string  | Worker CUIL (11 digits, format XX-XXXXXXXX-X) | `27-94689765-0`                                                                            |
| `apellidoNombre`      | string  | Full name (APELLIDO NOMBRE)                   | `PAREDES FRETES ZULLY SOFIA`                                                               |
| `tipoTrabajo`         | enum    | Worker category                               | `Personal para tareas generales`, `Asistencia y cuidado de personas`                       |
| `domicilioLaboral`    | string  | Work address                                  | `Chile 849 PILAR BUENOS AIRES`                                                             |
| `horasSemanales`      | enum    | Weekly hours bracket                          | `Menos de 12 horas`, `De 12 a menos de 16 horas`, `Desde 16 a más h`                       |
| `condicion`           | enum    | Employment status                             | `Activo`, `Baja`                                                                           |
| `obraSocial`          | string  | Health insurance                              | `AUXILIAR CASAS PARTICULARES`                                                              |
| `fechaNacimiento`     | date    | Date of birth                                 | `08/04/1985`                                                                               |
| `fechaIngreso`        | date    | Start date                                    | `20/09/2021`                                                                               |
| `modalidadPago`       | enum    | Payment frequency                             | `Diaria`, `Mensual`                                                                        |
| `modalidadTrabajo`    | enum    | Work arrangement                              | `Con retiro para distintos empleadores`, `Con retiro para un solo empleador`, `Sin retiro` |
| `remuneracionPactada` | decimal | Agreed salary                                 | `1600.00`                                                                                  |
| `fiscalYear`          | int     | Fiscal year                                   | `2025`                                                                                     |

### Recibo (DomesticReceipt)

Fields derived from the ARCA receipt PDF ("Recibo de Sueldo"):

| Field                  | Type    | Description                 | Example                                 |
| ---------------------- | ------- | --------------------------- | --------------------------------------- |
| `trabajadorId`         | FK      | Link to DomesticWorker      | —                                       |
| `periodo`              | string  | Month/year of the receipt   | `Febrero 2026`                          |
| `fiscalYear`           | int     | Fiscal year                 | `2026`                                  |
| `fiscalMonth`          | int     | 1-12                        | `2`                                     |
| `categoriaProfesional` | string  | Worker category on receipt  | `Personal para tareas generales`        |
| `modalidadPrestacion`  | string  | Work arrangement on receipt | `Con retiro para distintos empleadores` |
| `horasSemanales`       | string  | Hours bracket on receipt    | `Menos de 12 horas`                     |
| `modalidadLiquidacion` | string  | Settlement type             | `Mensual`                               |
| `totalHorasTrabajadas` | string  | Total hours in period       | `54 hs`                                 |
| `basico`               | decimal | Base salary                 | `343116.00`                             |
| `antiguedad`           | decimal | Seniority bonus             | `13724.00`                              |
| `viaticos`             | decimal | Travel allowance            | `40000.00`                              |
| `presentismo`          | decimal | Attendance bonus            | `34311.00`                              |
| `otros`                | decimal | Other items                 | `20000.00`                              |
| `total`                | decimal | Total salary (retribución)  | `451151.00`                             |
| `source`               | enum    | MANUAL, PDF, EMAIL, ARCA    | —                                       |
| `siradiqStatus`        | enum    | Submission status           | PENDING, SUBMITTED, etc.                |
| `originalFilename`     | string? | PDF filename                | `recibo-feb-2026.pdf`                   |
| `fileData`             | bytes?  | PDF binary                  | —                                       |
| `fileMimeType`         | string? | MIME type                   | `application/pdf`                       |

### Pago (DomesticPayment) — from "Detalle del Pago"

| Field       | Type    | Description                  | Example      |
| ----------- | ------- | ---------------------------- | ------------ |
| `reciboId`  | FK      | Link to DomesticReceipt      | —            |
| `tipoPago`  | enum    | APORTES, LRT, CONTRIBUCIONES | `APORTES`    |
| `importe`   | decimal | Amount paid                  | `1784.27`    |
| `fechaPago` | date    | Payment date                 | `02/03/2026` |

### SiRADIG "Deducción del Personal Doméstico" form fields

When submitting to SiRADIG, the form requires:

**Datos Identificatorios:**

- CUIT / CUIL (text, 11 digits)
- Apellido y Nombre (text, auto-populated after CUIL lookup)

**Período:**

- Mes Desde (month number, 1-12)
- Mes Hasta (month number, 1-12)

**Monto:**

- Monto Total (sum of all monthly contributions + retributions)

**Detalle Mensual** (one row per month, added via "Agregar Detalle de Pagos"):

- Mes (dropdown: Enero–Diciembre)
- Contribución > Monto (decimal)
- Contribución > Fecha de Pago (date)
- Retribución > Monto (decimal)
- Retribución > Fecha de Pago (date)

The "Contribución" amount maps to `APORTES + CONTRIBUCIONES` from ARCA's payment detail. The "Retribución" amount maps to the `total` field from the receipt. The dates come from the payment date in "Detalle del Pago".

## Acceptance Criteria

### Trabajadores a cargo (Perfil Impositivo section)

- [ ] New "Trabajadores a cargo" section within "Perfil Impositivo" page, positioned after "Cargas de familia"
- [ ] CRUD operations: create, view, edit, and delete workers
- [ ] Worker form validates CUIL format (XX-XXXXXXXX-X, 11 digits)
- [ ] "Importar desde ARCA" button that launches an automation job to pull workers from "Personal de Casas Particulares" service (similar to "Pull Cargas de Familia")
- [ ] Import uses worker CUIL as unique key — if already exists, update; if new, create
- [ ] Animation on rows that were created/updated during import
- [ ] "Enviar a SiRADIG" button per worker (exports worker + their receipts as "Deducción del personal doméstico")
- [ ] If the user navigates away during import, they should see import status or results when they return

### Recibos section (new dashboard section)

- [ ] New "Recibos" page at `/recibos` within the dashboard, with a table similar to Facturas
- [ ] Table columns: Período, Trabajador, Categoría Profesional, Total, Estado SiRADIG, Acciones
- [ ] Multi-select filters for: worker, period, SiRADIG status
- [ ] Four entry methods (like Facturas):
  - **Importar desde ARCA**: automated import from "Personal de Casas Particulares > Pagos y Recibos"
  - **Carga manual**: form dialog to manually enter receipt data
  - **Por email**: email-based ingest (same pattern as Facturas)
  - **Subir archivo**: PDF upload with OCR extraction of receipt fields
- [ ] View, edit, and delete individual receipts
- [ ] PDF viewer for receipts that have an attached file

### Importar desde ARCA (automation)

- [ ] New automation job type: `PULL_DOMESTIC_RECEIPTS`
- [ ] Automation logs into ARCA, navigates to "Personal de Casas Particulares" service at `https://serviciossegsoc.afip.gob.ar/RegimenesEspeciales/app/DomesticoP/index.aspx`
- [ ] For each worker in "Trabajadores a cargo":
  - Navigate to "DATOS DEL TRABAJADOR" to pull/update worker info
  - Navigate to "PAGOS Y RECIBOS" section
  - For each row in the payments table where "Estado del recibo" = "VER RECIBO":
    - Click "VER RECIBO" to download the receipt PDF
    - Click "Detalle de pago" to capture APORTES, LRT, and CONTRIBUCIONES breakdown
    - Auto-upload the downloaded PDF as a Recibo with extracted metadata
  - Paginate through all pages (the table is paginated: Primero, 1, 2, 3, 4, 5, ..., Ultimo)
- [ ] Deduplication: match by (trabajadorId + fiscalYear + fiscalMonth) — update if exists, create if new
- [ ] Also imports/updates the workers themselves (like PULL_DOMESTIC_WORKERS + PULL_DOMESTIC_RECEIPTS in one job)
- [ ] Real-time job status with logs visible to the user
- [ ] Max 3 retries on failure

### OCR / PDF parsing for receipts

- [ ] Extract fields from uploaded receipt PDFs (same pipeline pattern as Facturas: pdf-parse first, Tesseract fallback)
- [ ] Fields to extract from "Recibo de Sueldo" format:
  - Trabajador: Apellido y Nombre, CUIT/CUIL
  - Período: "LIQUIDACIÓN CORRESPONDIENTE AL PERÍODO: {month} {year}"
  - Categoría Profesional, Modalidad de Prestación, Horas semanales
  - Detalle de la Remuneración: Básico, Antigüedad, Viáticos, Presentismo, Otros, Total
- [ ] Auto-link receipt to existing worker by CUIL match
- [ ] Test fixture: `src/lib/ocr/__tests__/fixtures/arca-recibo-pago.pdf`

### Enviar a SiRADIG

- [ ] "Enviar a SiRADIG" action from the Recibos table (single or bulk)
- [ ] Uses exclusively the "Deducción del personal doméstico" category (`SERVICIO_DOMESTICO`)
- [ ] Groups receipts by worker CUIL and submits one SiRADIG deduction per worker per fiscal year
- [ ] Maps receipt data to SiRADIG form:
  - **CUIT/CUIL**: worker's CUIL
  - **Apellido y Nombre**: worker's name
  - **Mes Desde**: earliest receipt month for the worker
  - **Mes Hasta**: latest receipt month for the worker
  - **Monto Total**: auto-calculated sum of all monthly details
  - **Detalle Mensual** (one row per receipt month):
    - Mes: receipt month name
    - Contribución Monto: `APORTES + CONTRIBUCIONES` from payment detail (or from the "Pago" column in the payments table if detailed breakdown is not available)
    - Contribución Fecha de Pago: payment date
    - Retribución Monto: receipt `total` (salary)
    - Retribución Fecha de Pago: receipt period end date (last day of the month)
- [ ] If deduction already exists in SiRADIG for this worker (same CUIL), update it instead of creating a duplicate
- [ ] Preview step before submission (same as existing invoice submission flow)
- [ ] Status tracking: PENDING → QUEUED → PROCESSING → SUBMITTED / FAILED

## Technical Notes

### Database

New Prisma models: `DomesticWorker`, `DomesticReceipt`, `DomesticPayment`. Add new enum values:

- `JobType`: `PULL_DOMESTIC_RECEIPTS`, `SUBMIT_DOMESTIC_DEDUCTION`
- Consider a `ReciboSource` enum reusing the existing `InvoiceSource` enum

### API routes

- `GET/POST /api/recibos` — list and create receipts
- `GET/PUT/DELETE /api/recibos/[id]` — single receipt CRUD
- `POST /api/recibos/upload` — PDF upload with OCR
- `GET /api/recibos/[id]/file` — serve receipt PDF
- `GET/POST /api/trabajadores` — list and create workers
- `GET/PUT/DELETE /api/trabajadores/[id]` — single worker CRUD
- `POST /api/automatizacion/pull-recibos` — trigger ARCA receipt import
- `POST /api/automatizacion/submit-domestic-deduction` — trigger SiRADIG submission

### Automation

- Reuse existing browser pool and job processor patterns from `src/lib/automation/`
- ARCA "Personal de Casas Particulares" is a server-rendered ASP.NET app (not an SPA), so standard `goto` + `waitForLoadState('networkidle')` should work for page navigation
- "VER RECIBO" links trigger a PDF download — use Playwright's `download` event to capture the file
- The payments table is paginated — iterate through pages using the pagination links
- SiRADIG submission reuses existing patterns from invoice submission but targets the "Deducción del personal doméstico" form specifically

### UI

- "Trabajadores a cargo" section: card-based layout showing worker summary (name, CUIL, tipo, horas, condición), with edit/delete actions
- "Recibos" page: table layout matching Facturas page, with Dialog modals for upload and manual entry
- Receipt manual entry form should include a worker selector (dropdown of existing workers)
- Follow existing Jony Ive design language: clean whites, `border-gray-200`, `bg-gray-50`, generous whitespace

### Monetary calculations

All amounts use `Decimal.js` for precision, consistent with existing patterns.

## Out of Scope

- Creating/registering new workers in ARCA (only reading existing ones)
- Making payments in ARCA (the "PAGAR" button for unpaid months)
- Generating receipt PDFs from within desgrava.ar (only ARCA generates them)
- Managing ART (LRT) details beyond capturing the payment amount
- Historical workers ("VER TRABAJADORES HISTÓRICOS") — only active workers
- CBU, phone, email, and domicilio real of workers (non-essential fields for deduction purposes)
