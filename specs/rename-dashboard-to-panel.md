---
title: Rename /dashboard Route to /panel
status: implemented
priority: low
---

## Summary

The dashboard landing page lives at `/dashboard`, but the sidebar already labels it "Panel" and we're consolidating user-visible URLs to Spanish. This spec renames the route from `/dashboard` to `/panel`, updates every internal reference (Links, redirects, NextAuth callback URL, replay query target), and refreshes CLAUDE.md. Pure rename — no behavior, no data, no backwards-compatibility shim. The internal route group `(dashboard)/` keeps its name since it never appears in URLs and renaming it cascades into many imports for zero user-visible benefit.

## Acceptance Criteria

### Page route

- [ ] `src/app/(dashboard)/dashboard/page.tsx` is moved (via `git mv`) to `src/app/(dashboard)/panel/page.tsx`
- [ ] Visiting `/panel` renders the dashboard landing page
- [ ] Visiting `/panel?replay=1` continues to trigger the tour-replay welcome modal (same query-param behavior as before)
- [ ] Visiting `/dashboard` returns Next.js's default 404 (no redirect, per the user's standing preference from the `/comprobantes` rename)

### Internal references

- [ ] Every `Link href="/dashboard..."`, `router.push("/dashboard")`, `redirect("/dashboard")`, `window.location.href = "/dashboard..."`, and NextAuth `callbackUrl: "/dashboard"` is updated to `/panel`. Specific files known from the grep:
  - `src/app/(auth)/login/login-form.tsx` (3 sites: success redirect after credentials login, Google `signIn` callbackUrl, and post-verify redirect)
  - `src/app/(dashboard)/comprobantes/page.tsx` (1× post-save redirect when first invoice is added)
  - `src/components/credenciales/credentials-form.tsx` (1× post-save redirect)
  - `src/components/configuracion/ayuda-card.tsx` (1× tour-replay link)
  - `src/components/onboarding/tour-replay-button.tsx` (1× tour-replay link)
  - `src/components/layout/dashboard-sidebar.tsx` (2 sites: nav item href + active-route check)
  - `src/components/layout/dashboard-mobile-nav.tsx` (same pair)
  - `src/components/layout/navbar.tsx` (2 Links from the public/landing navbar back to the panel)
- [ ] Final `grep -rn '"/dashboard\|/dashboard?\|/dashboard"' src/` returns zero hits with the deliberate exception of identifier references like `DashboardShell`, `DashboardSidebar`, `DashboardMobileNav`, `DashboardTour`, the `(dashboard)/` route-group folder, and any `data-tour` attributes — none of which are URL paths

### Tests

- [ ] `src/lib/__tests__/telegram.test.ts` — the fixture value `/dashboard` passed as `pageUrl` to `sendNewTicketNotification` is updated to `/panel` (it's an arbitrary example URL, but updating keeps it aligned with the live app)
- [ ] `npm run test` passes

### Docs

- [ ] `CLAUDE.md` references to `/dashboard` (lines 160, 161, 162 in the ARCA strip / Próximo paso / Comprobantes recientes paragraphs) are updated to `/panel`
- [ ] No mention of `/dashboard` remains in `CLAUDE.md` (apart from `(dashboard)/` route-group references and component identifiers, which keep their names)

### Build / lint / format

- [ ] `npm run lint && npm run format:check && npm run build && npm run test` all pass
- [ ] `npx tsc --noEmit` is clean

## Technical Notes

- **Folder move**: a single `git mv src/app/(dashboard)/dashboard src/app/(dashboard)/panel` preserves history.
- **Route group stays**: `src/app/(dashboard)/` is the auth-protected layout group that wraps all dashboard routes. Its name is invisible in URLs (parentheses denote a route group), so there's no user-visible reason to rename it. Renaming it would touch every nested page's import paths and the `DashboardShell` layout for zero benefit.
- **Component identifiers stay**: `DashboardShell`, `DashboardSidebar`, `DashboardMobileNav`, `DashboardTour`, `useDomesticWorkerCount`, the `dashboard-tour.tsx` filename, and other internal `Dashboard`-prefixed identifiers are not URLs — they describe the protected/landing area. Per the surgical-changes rule, leave them.
- **NextAuth**: the only `callbackUrl` we use is on the Google `signIn` call in `login-form.tsx`. NextAuth itself doesn't store this path anywhere durable (it's per-call), so no config change is needed.
- **Search recipe** the implementer should run before declaring done:
  ```
  grep -rn '"/dashboard\|/dashboard?\|/dashboard"' src/
  grep -n "/dashboard" CLAUDE.md
  ```
  Both should return zero hits after the rename, ignoring intentional exceptions.
- **No DB / API / business-logic changes**: this is a string-only refactor.
- **No mobile-first / dark-mode work**: rename only touches strings.

## Out of Scope

- Renaming the `(dashboard)/` route group to `(panel)/` or anything else
- Renaming any `Dashboard*` identifier (`DashboardShell`, `DashboardSidebar`, `DashboardMobileNav`, `DashboardTour`, `dashboard-tour.tsx`, `comprobantes-recientes.tsx` if it had any internal "dashboard" references, etc.)
- Backwards-compatible redirect from `/dashboard` to `/panel` (the user has consistently opted out of redirects on these renames)
- Updating the visible page heading on `/panel` (the user's request was scoped to the route)
- Renaming variables, hooks, types, or context fields that contain the substring `dashboard`
- Touching any `data-tour="..."` selectors that contain the substring `dashboard`
- External docs, marketing copy, or landing-page wording outside `src/`
- Migrating user-saved bookmarks (zero users)
