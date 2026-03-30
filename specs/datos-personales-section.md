---
title: Datos Personales Section in Perfil Impositivo
status: implemented
priority: medium
---

## Summary

Add a "Datos Personales" section at the top of the Perfil Impositivo page, above the existing Empleadores section. This displays the user's personal data (name and address) as read-only information imported from SiRADIG. The only user action is "Importar desde SiRADIG", which pulls the data via browser automation. This gives users visibility into the personal information ARCA/SiRADIG has on file, which is used in tax form submissions.

## Acceptance Criteria

### Data Model

- [ ] New `PersonalData` Prisma model with fields: `id`, `userId`, `fiscalYear`, `apellido`, `nombre`, `dirCalle`, `dirNro`, `dirPiso` (nullable), `dirDpto` (nullable), `descProvincia`, `localidad`, `codPostal`, timestamps
- [ ] Unique constraint on `[userId, fiscalYear]` (one record per user per year)
- [ ] Relation to `User` (cascade delete)
- [ ] Migration created and applied

### API

- [ ] `GET /api/datos-personales?year={year}` — Returns personal data for user+year (or null if not imported yet)
- [ ] Protected via `getServerSession`; no write/delete routes (data comes only from SiRADIG import)

### UI — Datos Personales Section

- [ ] New `PersonalDataSection` component in `src/components/perfil/`
- [ ] Positioned at the top of Perfil Impositivo, above the Empleadores section
- [ ] Shows two groups matching SiRADIG's layout:
  - **Apellido y Nombre**: Apellido, Nombre
  - **Domicilio**: Calle, Nro, Piso, Dpto, Provincia, Localidad, Código Postal
- [ ] All fields rendered as read-only text (not editable inputs)
- [ ] "Importar desde SiRADIG" button triggers a `PULL_PERSONAL_DATA` automation job with SSE progress tracking
- [ ] Empty state when no data has been imported: icon + "No hay datos personales importados para este periodo" + import button
- [ ] After import: green highlight animation on new/updated data (3s fade, same as Empleadores)
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

### Automation — Import (PULL_PERSONAL_DATA)

- [ ] New `PULL_PERSONAL_DATA` job type
- [ ] Job steps: `login` → `siradig` → `extract` → `done`
- [ ] Navigate to SiRADIG → select person → select fiscal period → Continuar → dismiss modal → create/reuse draft → click `#btn_datos_personales`
- [ ] Extract fields from the two fieldsets:
  - Fieldset "Apellido y Nombre": `#apellido`, `#nombre`
  - Fieldset "Domicilio": `#dirCalle`, `#dirNro`, `#dirPiso`, `#dirDpto`, `#descProvincia`, `#localidad`, `#codPostal`
- [ ] Upsert into DB: match by `userId + fiscalYear`, create or update
- [ ] Add selectors to `ARCA_SELECTORS.siradig.datosPersonales` (extend existing group):
  - `formApellido: "#apellido"`
  - `formNombre: "#nombre"`
  - `formDirCalle: "#dirCalle"`
  - `formDirNro: "#dirNro"`
  - `formDirPiso: "#dirPiso"`
  - `formDirDpto: "#dirDpto"`
  - `formDescProvincia: "#descProvincia"`
  - `formLocalidad: "#localidad"`
  - `formCodPostal: "#codPostal"`
- [ ] Add `PULL_PERSONAL_DATA` to `JOB_TYPE_STEPS` in `job-steps.ts`

### Job API

- [ ] `/api/automatizacion` accepts `PULL_PERSONAL_DATA` (requires `fiscalYear`)

## Technical Notes

- Follow the exact patterns from `EmployersSection`: state management, SSE via `EventSource`, import with `connectToJobSSE`, active job recovery on mount, highlight animations.
- All SiRADIG form fields are `readonly` — the automation only needs to read `.value` from each input, no interaction beyond clicking `#btn_datos_personales`.
- The `datosPersonales` selector group already exists in `selectors.ts` with `menuButton`, `guardarBtn`, and `volverBtn`. Extend it with the form field selectors.
- Navigation reuses `navigateToSiradigMainMenu` (which already handles the Datos Personales confirmation flow for first-time users), then clicks `#btn_datos_personales` to enter the section.
- After extraction, click `#btn_volver` to return to the main menu (in case the automation continues with other SiRADIG operations).
- Mobile: design for 320px first. Use a two-column grid for address fields on desktop (`sm:grid-cols-2`), single column on mobile. Full-width layout. 44px touch targets for the import button.

## Out of Scope

- **Editing personal data from desgrava.ar**: Data is read-only. Users must update via ARCA's "Sistema Registral" as the SiRADIG page itself states.
- **Exporting/pushing personal data to SiRADIG**: No PUSH_PERSONAL_DATA job type.
- **Historical data**: Only current fiscal year data is shown, no year-over-year comparison.
- **Address validation or geocoding**: Data is displayed as-is from SiRADIG.
