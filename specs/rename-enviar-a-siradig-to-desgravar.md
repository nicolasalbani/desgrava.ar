---
title: Rename Enviar a SiRADIG to Desgravar
status: implemented
priority: medium
---

## Summary

Replace all user-facing instances of "Enviar a SiRADIG" (and variations like "enviado a la cola de SiRADIG", "envios a SiRADIG") with "Desgravar" (and matching conjugations like "desgravado", "desgravando", "desgravaciones") throughout the app. This reinforces the app's name (desgrava.ar) and reframes the action in terms of value ("tax deduction") rather than mechanism ("submit to SiRADIG").

## Acceptance Criteria

- [ ] Bulk action button reads "Desgravar" instead of "Enviar a SiRADIG" in both invoice list and receipt list
- [ ] Individual row send icon tooltip reads "Desgravar" (all compact and table views, invoices and receipts)
- [ ] Onboarding tour step title reads "Desgravar", description reads "Envia tus deducciones automaticamente", completed state reads "Desgravaciones activas"
- [ ] Success toasts use "desgravado/a" phrasing — e.g., "Comprobante desgravado", "N comprobante(s) desgravado(s)", "Recibo salarial desgravado", "Deduccion de servicio domestico desgravada"
- [ ] First-submission celebration toast reads "Tu primera deduccion fue desgravada"
- [ ] Error toasts use "desgravar" phrasing — e.g., "Error al desgravar", "Seleccioná un año fiscal antes de desgravar"
- [ ] Delete confirmation description references "desgravaciones asociadas" instead of "envios a SiRADIG asociados"
- [ ] In-flight tooltip reads "Hay una desgravacion en curso" instead of "Hay un envio en curso"
- [ ] "Exportar a SiRADIG" tooltips on family dependents and employers sections updated to "Desgravar"
- [ ] Landing page feature bento card title reads "Desgravacion automatica" instead of "Envio automatico a SiRADIG"
- [ ] Support system prompt updated to use "desgravar" language
- [ ] Backend API error messages returned to users updated (rental dates, educational expenses validation)

## Technical Notes

Files to update (user-facing strings only):

**Dashboard components:**

- `src/components/facturas/invoice-list.tsx` — bulk button, tooltips, toasts, delete dialog, in-flight tooltip
- `src/components/recibos/receipt-list.tsx` — bulk button, tooltips, toasts, in-flight tooltip
- `src/components/perfil/family-dependents.tsx` — "Exportar a SiRADIG" tooltip
- `src/components/perfil/employers-section.tsx` — "Exportar a SiRADIG" tooltip
- `src/components/dashboard/onboarding-tour.tsx` — tour step title, description, completed state, completion message

**Landing page:**

- `src/components/landing/features-bento.tsx` — feature card title and description

**Backend (user-facing error messages):**

- `src/app/api/automatizacion/route.ts` — validation error messages
- `src/lib/soporte/system-prompt.ts` — AI support chat knowledge base
- `src/lib/automation/siradig-navigator.ts` — user-facing validation error
- `src/lib/automation/job-processor.ts` — user-facing log message

**Specs (consistency):**

- Update references in existing specs that mention "Enviar a SiRADIG"

URL paths, API routes, DB fields, variable names, and internal code identifiers remain unchanged.

## Out of Scope

- Renaming URL paths or API routes
- Renaming component files, directories, or variable names
- Changing the `Send` lucide icon used for the action (icon stays the same)
- Changing job type enums (`SUBMIT_INVOICE`, etc.)
- Changes to the `Presentaciones` section (separate feature)
