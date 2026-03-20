---
title: Include Historical Workers in ARCA Pull
status: implemented
priority: medium
---

## Summary

The "Importar desde ARCA" worker pull (`PULL_DOMESTIC_WORKERS`) currently only imports active workers from the main page. Workers who were terminated (`condicion: "Baja"`) during the selected fiscal year are missed entirely — they live under "VER TRABAJADORES HISTÓRICOS" in ARCA. Since these workers may have had receipts and contributions during months they were active, their data is needed for accurate SiRADIG deductions. The receipt pull already handles historical workers; the worker pull should too.

## Acceptance Criteria

- [ ] `pullDomesticWorkersOnly` also navigates to "VER TRABAJADORES HISTÓRICOS" and extracts worker data from each historical worker's "DATOS DEL TRABAJADOR" page
- [ ] Historical workers are upserted into `DomesticWorker` with the same logic as active workers (match by `userId + fiscalYear + cuil`)
- [ ] Historical workers have their `condicion` field set to whatever ARCA reports (typically `"Baja"`)
- [ ] The import log reports totals separately: e.g., "3 activos, 1 histórico — 2 nuevos, 2 actualizados"
- [ ] If "VER TRABAJADORES HISTÓRICOS" link doesn't exist (user has no terminated workers), the pull completes normally with only active workers
- [ ] Historical workers with `fechaIngreso` after the fiscal year ends are skipped (they were never active during the target year)
- [ ] The UI (Perfil Impositivo > Trabajadores a cargo) displays both active and historical workers — historical workers should show a visual indicator of their `"Baja"` status

## Technical Notes

- **Main change is in `src/lib/automation/domestic-navigator.ts`**: The `pullDomesticInternal` function (used by `pullDomesticWorkersOnly`) currently only iterates `"DATOS DEL TRABAJADOR"` links on the main page (active workers). Extend it to also navigate to "VER TRABAJADORES HISTÓRICOS" — the same pattern already exists in `pullHistoricWorkerReceipts` (lines 283-379) but only extracts receipts, not worker data.
- **Reuse `extractWorkerFromDetailPage`**: Historical worker detail pages (`VerTrabajador.aspx`) have the same layout as active worker detail pages — the existing extraction function should work as-is.
- **`pullHistoricWorkerReceipts` already navigates historical workers**: Consider extracting the "navigate to historical workers and iterate their detail pages" logic into a shared helper to avoid duplication between worker pull and receipt pull.
- **Job processor** (`src/lib/automation/job-processor.ts`): The `processPullDomesticWorkers` function (line 397) needs no structural changes — it already upserts all workers returned by `pullDomesticWorkersOnly`. It just needs to receive the additional historical workers.
- **Filtering by fiscal year relevance**: A historical worker should be included if their `fechaIngreso` is before the end of the fiscal year. We can't reliably determine the exact termination date from the detail page, so include all historical workers and let the user manage relevance.

## Out of Scope

- Changing receipt pull behavior (already handles historical workers)
- Filtering historical workers by termination date (not reliably available from ARCA)
- Re-activating or modifying worker status in ARCA
