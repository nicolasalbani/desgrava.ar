---
title: Fiscal Year Read-Only After March 31st Cutoff
status: implemented
priority: high
---

## Summary

After March 31st each year, the previous fiscal year is no longer accessible in SiRADIG. Users can still view their data for past years, but all automation buttons (import from ARCA, export to SiRADIG, submit invoices/receipts/presentaciones) should be disabled (grayed out) for fiscal years that are past the cutoff. This prevents users from triggering automation jobs that will inevitably fail because SiRADIG won't allow access to that period.

## Acceptance Criteria

### Core Logic

- [ ] New utility function `isFiscalYearReadOnly(fiscalYear: number): boolean` in `src/lib/soporte/` or `src/lib/` that returns `true` when:
  - The fiscal year is before the current year AND the current date is after March 31st of the current year
  - Example: fiscal year 2025 becomes read-only on April 1st 2026
  - Fiscal years before (currentYear - 1) are always read-only (e.g., 2024 is always read-only in 2026)
  - The current fiscal year is never read-only
- [ ] The utility is usable both server-side (API routes) and client-side (components)

### Perfil Impositivo

- [ ] **Datos Personales**: "Importar desde SiRADIG" button disabled when fiscal year is read-only
- [ ] **Empleadores**: "Importar desde SiRADIG" button disabled when fiscal year is read-only
- [ ] **Empleadores**: Per-employer "Exportar a SiRADIG" button and edit/delete actions disabled when fiscal year is read-only
- [ ] **Cargas de Familia**: "Importar desde SiRADIG" button disabled when fiscal year is read-only
- [ ] **Cargas de Familia**: Per-dependent "Exportar a SiRADIG" button and edit/delete actions disabled when fiscal year is read-only

### Facturas

- [ ] All action buttons disabled when fiscal year is read-only: "Importar desde ARCA", "Nueva factura", "Subir PDF", "Enviar a SiRADIG" (bulk and individual), "Cambiar categoría" (bulk), "Eliminar" (bulk and individual), edit (per-invoice)
- [ ] Checkboxes (row selection) disabled when fiscal year is read-only
- [ ] Filtering (category, status, search) and pagination remain fully functional
- [ ] Viewing invoice details and downloading PDFs remain functional

### Recibos

- [ ] All action buttons disabled when fiscal year is read-only: "Importar desde ARCA", "Nuevo recibo", "Subir PDF", "Enviar a SiRADIG" (bulk and individual), "Eliminar" (bulk and individual)
- [ ] Checkboxes (row selection) disabled when fiscal year is read-only
- [ ] Filtering (worker, status, search) and pagination remain fully functional
- [ ] Viewing receipt details and downloading PDFs remain functional

### Presentaciones

- [ ] All action buttons disabled when fiscal year is read-only: "Importar desde ARCA", "Enviar Presentación"
- [ ] Viewing presentaciones and downloading PDFs remain functional

### Fiscal Year Selector

- [ ] Remove the next year (currentYear + 1) from the fiscal year selector options — SiRADIG only allows the current year and (before April) the previous year. For example, in 2026 the options should be `[2025, 2026]` (Jan–Mar) or just `[2026]` (Apr–Dec), never `[2027]`
- [ ] After the March 31st cutoff, the selector should only show the current year (previous year is read-only but still selectable for viewing historical data)

### User Feedback

- [ ] When a read-only fiscal year is selected, a subtle banner or badge appears near the fiscal year selector indicating that the year is read-only (e.g., "Período cerrado en SiRADIG" or similar)
- [ ] The banner should be dismissable or non-intrusive — informational, not blocking

### API Guard

- [ ] `POST /api/automatizacion` rejects job creation for read-only fiscal years with a 400 error and a clear message (e.g., "El período fiscal YYYY ya no está disponible en SiRADIG")
- [ ] This is a safety net — the UI should prevent the action, but the API should also enforce it

## Technical Notes

- The cutoff logic is simple: `fiscalYear < currentYear && currentMonth > 3` (after March). Between Jan 1–Mar 31, the previous year is still writable.
- The utility should be a pure function with no dependencies so it's easily testable and importable anywhere.
- On the UI side, the simplest approach is a shared hook like `useFiscalYearReadOnly()` that combines `useFiscalYear()` with the cutoff check and returns a boolean. Components pass this to the `disabled` prop of their automation buttons.
- Disabled buttons should be visually grayed out (standard `disabled` styling via the existing Button component) so users understand the action exists but isn't available for this period.
- The existing `requireWriteAccess()` pattern (subscription enforcement) is server-side only. This fiscal year check follows a dual approach: enforce on the client (disable buttons) with a server-side safety net on the automation endpoint.
- The fiscal year selector in the dashboard header should still allow selecting past years (for viewing data), but the read-only indicator should be visible.

## Out of Scope

- **Data entry for past years via other means**: If a future feature allows importing data outside of ARCA/SiRADIG, that would need its own read-only consideration.
- **Removing past years from the fiscal year selector**: Users should still be able to view historical data.
- **Automation for future fiscal years**: Not addressed here — the current `isFuture` check on invoices already handles this.
- **Adding future fiscal years**: SiRADIG doesn't support future years, so they should never appear as options.
