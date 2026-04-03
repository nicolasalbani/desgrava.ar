---
title: Optimize ARCA Portal Navigation — Skip "Ver todos" Page
status: draft
priority: high
---

## Summary

All ARCA service navigation flows currently navigate to the "/mis-servicios" (Ver todos) page before using the search bar to find a service. The portal's search bar (`#buscadorInput`) is available in the top navbar on every portal page — including the home page where users land after login. By searching directly from the current page instead of navigating to "/mis-servicios" first, we eliminate one full page load (`goto` + `networkidle` wait) per service access. For jobs that access multiple services (e.g., `PULL_COMPROBANTES` which hits both SiRADIG and Mis Comprobantes), the savings compound.

## Acceptance Criteria

- [ ] `navigateToSiradig()` in `arca-navigator.ts` searches from the current portal page instead of navigating to `/mis-servicios`
- [ ] `navigateToMisComprobantes()` in `mis-comprobantes-navigator.ts` searches from the current portal page instead of navigating to `/mis-servicios`
- [ ] `openServiceViaPortal()` in `domestic-navigator.ts` searches from the current portal page instead of navigating to `/mis-servicios`
- [ ] All three flows still correctly open their target service in a new tab via SSO
- [ ] Each flow clears the search input before typing (in case of previous search residue) and handles the typeahead dropdown as before
- [ ] If the search bar is not visible on the current page (edge case: unexpected redirect), fall back to navigating to `/mis-servicios`
- [ ] Navigation time per service access is reduced by eliminating the `/mis-servicios` page load — target savings of 3-8 seconds per service depending on network conditions (the `networkidle` wait on `/mis-servicios` typically takes 3-8s)
- [ ] All existing automation job types pass end-to-end testing against live ARCA: `PUSH_INVOICE`, `PULL_COMPROBANTES`, `PULL_DOMESTIC_WORKERS`, `PULL_DOMESTIC_RECEIPTS`, `PULL_PRESENTACIONES`, `PULL_FAMILY_DEPENDENTS`, `PUSH_FAMILY_DEPENDENTS`
- [ ] Multi-service jobs (e.g., `PULL_COMPROBANTES` which accesses SiRADIG then Mis Comprobantes) show compounded time savings

## Technical Notes

- The ARCA portal is a React SPA. The top navbar with `#buscadorInput` (react-bootstrap-typeahead) is present on all portal pages, including the home page (`/portal/app/`). The current `goto("/mis-servicios")` is unnecessary — it loads the full services grid just to use the same search bar that's already in the navbar.
- Three files need the same change pattern — remove the `goto(allServicesUrl)` call and instead wait for `#buscadorInput` to be visible on the current page:
  - `src/lib/automation/arca-navigator.ts` — `navigateToSiradig()`
  - `src/lib/automation/mis-comprobantes-navigator.ts` — `navigateToMisComprobantes()`
  - `src/lib/automation/domestic-navigator.ts` — `openServiceViaPortal()`
- For the second service access in multi-service jobs (e.g., after closing the SiRADIG tab and returning to the portal tab), the portal page is already loaded — just clear the search input and search again. No navigation needed.
- The fallback to `/mis-servicios` should use a short timeout (2-3s) on `#buscadorInput` visibility before falling back, to avoid breaking flows if the portal layout changes.
- Selectors remain the same: `ARCA_SELECTORS.portal.searchService`, `searchResultsList`, `searchResultOption`.
- Use `/arca-assisted-navigation` to verify the search bar exists on the portal home page before implementing.
- Test timing with `Date.now()` measurements around the navigation section before and after the change.

## Out of Scope

- Changing the ARCA login flow itself.
- Changing how services behave after they open in a new tab (SiRADIG, Mis Comprobantes, Casas Particulares internal navigation).
- Adding new ARCA services or job types.
- Caching or reusing service tabs across jobs.
