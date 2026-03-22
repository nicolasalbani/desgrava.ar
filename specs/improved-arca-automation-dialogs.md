---
title: Improved ARCA Automation Pre-Execution Dialogs
status: implemented
priority: medium
---

## Summary

Standardize all ARCA automation dialogs to show a clear, step-by-step explanation of what will happen before the user clicks to start — matching the format already used in the facturas import dialog (numbered steps under "Esto va a:"). Add a "No volver a mostrar" checkbox that, when checked, skips the explanation screen on future uses and immediately starts the automation.

## Acceptance Criteria

### Step-by-step descriptions for all dialogs

- [ ] **Import Recibos** (`src/components/recibos/import-arca-dialog.tsx`) idle state shows numbered steps:
  1. Iniciar sesión en ARCA con tus credenciales guardadas
  2. Ir a "Personal de Casas Particulares"
  3. Importar los datos de cada trabajador
  4. Descargar los recibos de sueldo con archivos PDF
  - Footer note: "Los recibos que ya tengas cargados no se van a duplicar."
- [ ] **Import Presentaciones** (`src/components/presentaciones/import-arca-dialog.tsx`) idle state shows numbered steps:
  1. Iniciar sesión en ARCA con tus credenciales guardadas
  2. Ir a SiRADIG → Carga de Formulario → Consulta de Formularios Enviados
  3. Importar el historial de formularios enviados al empleador
  4. Descargar cada formulario en PDF (Sección A)
  - Footer note: "Las presentaciones que ya tengas cargadas no se van a duplicar."
- [ ] **Submit Presentación** (`src/components/presentaciones/submit-presentacion-dialog.tsx`) idle state shows numbered steps:
  1. Iniciar sesión en ARCA con tus credenciales guardadas
  2. Ir a SiRADIG → Carga de Formulario → Vista Previa
  3. Descargar el borrador del formulario en PDF
  4. Enviar la presentación al empleador ("Generar Presentación")
  - Footer note: "Se generará una nueva presentación para el periodo {year}."
- [ ] **Import Facturas** (`src/components/facturas/import-arca-dialog.tsx`) — already has the correct format; only needs the "don't show again" checkbox added
- [ ] All 4 dialogs use the same visual format: `bg-muted/40 rounded-xl p-4` card with "Esto va a:" header, numbered list, and footer note (matching the existing facturas dialog style)

### "No volver a mostrar" checkbox

- [ ] Each dialog shows a checkbox below the step list: "No volver a mostrar este mensaje"
- [ ] When checked and the user clicks the action button, the preference is saved to `UserPreference`
- [ ] On next open, if the preference is set, the dialog skips the idle state and immediately starts the automation (showing the running/logs state directly)
- [ ] New field on `UserPreference`: `skipArcaDialogs` (`Boolean`, default `false`) — a single flag that applies to all ARCA automation dialogs
- [ ] `GET /api/configuracion` returns `skipArcaDialogs` in the response
- [ ] `PUT /api/configuracion` accepts `skipArcaDialogs` to update the preference
- [ ] The checkbox uses the existing `Checkbox` shadcn component with a `text-muted-foreground text-xs` label

### Behavior when "skip" is enabled

- [ ] When the dialog opens and `skipArcaDialogs` is true, the automation starts automatically (no idle screen)
- [ ] The running/logs/completed/failed states remain unchanged — only the idle confirmation screen is skipped
- [ ] Users can re-enable the confirmation by unchecking the preference (which is shown in the idle state when they do see it, e.g., if preference is reset or first time)

## Technical Notes

- **Existing pattern**: The facturas import dialog at `src/components/facturas/import-arca-dialog.tsx` already implements the step-by-step format. Use it as the template for the other 3 dialogs.
- **Preference storage**: Add `skipArcaDialogs Boolean @default(false)` to the `UserPreference` model in `prisma/schema.prisma`. Extend `GET/PUT /api/configuracion` to include it.
- **Preference fetching**: Each dialog can fetch the preference via `/api/configuracion` on mount (or accept it as a prop from the parent page which may already fetch it).
- **Auto-start logic**: In each dialog's `useEffect` that runs on `open` change, check if `skipArcaDialogs` is true and `status === "idle"`, then call the start function directly.
- **Dark mode**: All new UI must use semantic tokens (`bg-muted`, `text-muted-foreground`, etc.) — no raw colors without `dark:` counterparts.

## Out of Scope

- Per-dialog skip preferences (e.g., skip only for facturas but not recibos) — a single flag covers all
- Adding step-by-step descriptions to non-ARCA automation flows (e.g., SiRADIG invoice submission from Facturas/Recibos rows)
- Configuración UI to toggle this preference (the checkbox in the dialog is the UI)
- Changing the running/completed/failed states of any dialog
