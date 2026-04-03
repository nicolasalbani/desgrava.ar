---
title: Rename Recibos to Recibos Salariales
status: implemented
priority: low
---

## Summary

Rename all user-facing instances of "Recibos" to "Recibos salariales" (and "recibo" to "recibo salarial" in singular form) throughout the dashboard. This improves clarity by distinguishing salary receipts from other types of receipts, making the label more descriptive for users.

## Acceptance Criteria

- [ ] Sidebar navigation label reads "Recibos salariales" (both desktop `dashboard-sidebar.tsx` and mobile `dashboard-mobile-nav.tsx`)
- [ ] Page heading (h1) on `/recibos` reads "Recibos salariales"
- [ ] All toast messages use "recibo salarial" (singular) / "recibos salariales" (plural) — e.g., "Recibo salarial eliminado", "Recibos salariales importados desde ARCA"
- [ ] Dialog titles updated: "Subir recibo salarial", "Eliminar recibo salarial", "Importar recibos salariales desde ARCA"
- [ ] Empty state message reads "No hay recibos salariales cargados"
- [ ] Count display uses correct singular/plural: "1 recibo salarial" / "N recibos salariales"
- [ ] Delete confirmation text updated to "recibo salarial" / "recibos salariales"
- [ ] Aria labels updated to include "salarial" (e.g., `Seleccionar recibo salarial ${r.id}`)
- [ ] Button text updated: "Crear recibo salarial"
- [ ] Bulk delete button: "Eliminar N recibo(s) salarial(es)"

## Technical Notes

Files to update (user-facing strings only — no route paths, DB fields, or variable names change):

- `src/components/layout/dashboard-sidebar.tsx` — nav label
- `src/components/layout/dashboard-mobile-nav.tsx` — nav label
- `src/app/(dashboard)/recibos/page.tsx` — h1, dialog titles/descriptions
- `src/components/recibos/receipt-list.tsx` — toasts, empty state, count, delete dialogs, aria labels
- `src/components/recibos/receipt-uploader.tsx` — toast, button text
- `src/components/recibos/receipt-form.tsx` — toast, button text
- `src/components/recibos/import-arca-dialog.tsx` — dialog title, description, toasts

URL paths (`/recibos`), API routes, component file names, and database schema remain unchanged.

## Out of Scope

- Renaming URL paths or API routes (stays `/recibos`)
- Renaming component files or directories (stays `recibos/`, `receipt-*.tsx`)
- Renaming database tables or fields
- Renaming internal variable/function names
- Changes to the landing page or marketing copy
