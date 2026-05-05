---
title: Collapsible sidebar toggle
status: implemented
priority: medium
---

## Summary

The desktop dashboard sidebar (`dashboard-sidebar.tsx`) is a fixed 256px (`w-64`) panel that always shows full-text labels next to each nav icon. Power users on smaller laptops want to reclaim that horizontal space for tables and forms without losing access to navigation. This feature adds a toggle that collapses the sidebar to an icon-only rail (~64px wide) with hover tooltips for labels, persists the preference in `localStorage`, and supports a `[` keyboard shortcut.

## Acceptance Criteria

### Sidebar collapse behavior

- [ ] On desktop (`md` and above), the sidebar can be in one of two states: `expanded` (current `w-64` with icons + labels) or `collapsed` (`w-16`, icons only).
- [ ] In `collapsed` mode, each nav item renders as an icon-only square button. The text label is hidden but accessible via a tooltip on hover/focus (use the existing `Tooltip` component from `src/components/ui/tooltip.tsx`).
- [ ] In `collapsed` mode, the header `<Link>` shows only the logo image — the "desgrava.ar" text is hidden.
- [ ] In `collapsed` mode, the active-route highlight still applies (`bg-primary text-primary-foreground`) but as a centered icon button rather than a full-width row.
- [ ] In `collapsed` mode, attention badges (`AttentionBadge`) still appear as a small numbered dot in the top-right corner of the icon, so users can still see counts at a glance.
- [ ] Width transitions smoothly between states (`transition-[width] duration-200 ease-in-out`); nav item content does not wrap or jump during the transition.

### Toggle control

- [ ] A toggle button is rendered as a small circular chevron tab on the sidebar's right edge, vertically centered (common Notion/Linear pattern). It overlaps the border slightly so it reads as a handle.
- [ ] The chevron icon points left (`ChevronLeft`) when expanded and right (`ChevronRight`) when collapsed.
- [ ] Clicking the toggle flips the state and persists it.
- [ ] The button has an `aria-label` of "Contraer barra lateral" / "Expandir barra lateral" depending on state.
- [ ] The button has a visible focus ring and is keyboard-reachable via Tab.

### Keyboard shortcut

- [ ] Pressing `[` anywhere on the dashboard toggles the sidebar, except when focus is inside an `<input>`, `<textarea>`, or any element with `contenteditable`.
- [ ] The shortcut uses a global key listener registered while the dashboard shell is mounted; it is removed on unmount.

### Persistence

- [ ] Collapse state is read from `localStorage` under key `desgrava:sidebar-collapsed` on first render.
- [ ] State writes back to `localStorage` whenever the user toggles.
- [ ] If `localStorage` is unavailable (SSR, private mode), the sidebar defaults to `expanded` and no error is thrown.
- [ ] To avoid a flash-of-expanded on hydration, the initial render reads the value before paint (e.g., uncontrolled `useState` initializer that reads `localStorage` only on the client, or a small inline script in the layout that sets a class on `<html>`). Choose whichever is least invasive.

### Disabled nav items in collapsed mode

- [ ] The existing disabled items (`/recibos` without trabajadores, `/comprobantes` without employers) still show the existing reason tooltip in collapsed mode — the tooltip simply replaces the in-line label tooltip for that item.

### Dashboard tour compatibility

- [ ] The post-onboarding tour's `data-tour="nav-presentaciones"` selector still resolves to a visible element in collapsed mode (the icon link). The spotlight does not need to expand the sidebar; it just highlights the icon-sized target.
- [ ] If any tour step ends up unreadable due to the collapsed width, expand the sidebar for the duration of the tour. Implementer's choice — pick whichever is simpler.

### Mobile unchanged

- [ ] On screens below `md` (< 768px), the sidebar remains hidden and `dashboard-mobile-nav.tsx` continues to be the only navigation surface — no toggle, no collapsed-rail variant.

### UI quality

- [ ] All new UI works on screens as narrow as 320px (the rail is desktop-only, so on mobile the toggle is not rendered at all).
- [ ] Dark mode tokens (`bg-background`, `border-border`, `text-muted-foreground`, etc.) are used; no hardcoded colors that would break in dark mode.

## Technical Notes

### State management

The collapsed state is local UI state, not domain state — no DB column, no API route, no NextAuth session field. A small `useSidebarCollapsed()` hook in `src/hooks/` is the cleanest home for the localStorage read/write + key handler. It returns `{ collapsed, setCollapsed, toggle }`.

The hook must be SSR-safe: initial value is `false`, then read from `localStorage` in a `useEffect` and update. To avoid layout flash, also accept the option of an inline `<script>` in the dashboard layout that sets `document.documentElement.dataset.sidebarCollapsed` before React hydrates, and have the sidebar read that during the initial render. Either approach is fine; pick the simpler one when implementing.

### Files to modify

- `src/components/layout/dashboard-sidebar.tsx` — main changes: accept/derive collapsed state, conditionally render labels, swap full-row layout for icon-only layout, add the chevron toggle button.
- `src/components/layout/dashboard-shell.tsx` — host the keyboard shortcut listener (or delegate to the hook).
- `src/hooks/use-sidebar-collapsed.ts` — new hook owning state, localStorage, and key handler.
- `src/hooks/__tests__/use-sidebar-collapsed.test.ts` — tests per the project's "tests for every new `src/lib/` and `src/hooks/` module" rule. Cover: default value, localStorage read on mount, write on toggle, ignored when focus is in an `<input>`, no-op when `localStorage` throws.
- `src/components/shared/attention-badge.tsx` — may need a `compact` variant (small dot with number) for the collapsed-rail icon. Keep the existing inline variant for the expanded sidebar.

### Layout details

- Collapsed width: `w-16` (64px) — enough for a centered 24×24 icon with comfortable padding.
- Toggle button: `absolute -right-3 top-1/2 -translate-y-1/2`, circular, `h-6 w-6`, white background with a 1px border, lucide `ChevronLeft` / `ChevronRight`. `z-10` so it floats above the border.
- The `<aside>` keeps `border-r`; the toggle sits on top of the border line.
- Tooltips: in collapsed mode every nav item is wrapped in `<TooltipProvider><Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip></TooltipProvider>`. Reuse the same wrapper structure already used for disabled items so the implementation stays uniform.

### Keyboard shortcut implementation

A single `keydown` listener on `window` filters events whose `target` is an editable element (`input`, `textarea`, `[contenteditable="true"]`). On a bare `[` keypress with no modifiers, call `toggle()`. Don't intercept when `Cmd`/`Ctrl`/`Alt` are held to avoid stomping on browser/OS shortcuts.

### Avoiding hydration flash

The dashboard shell is a client component, so the simplest path is to render the sidebar with `collapsed=undefined` until the first effect resolves the localStorage value, and apply width via CSS variables or a stable initial class to avoid layout jumps. Implementer can choose between this and the inline-script approach — both are acceptable.

## Out of Scope

- Per-account persistence (DB column, server-side preference) — localStorage only.
- Mobile sidebar redesign — `dashboard-mobile-nav.tsx` is untouched.
- Animating the chevron icon itself (just swap `ChevronLeft` ↔ `ChevronRight`).
- Resizable / drag-to-resize sidebar.
- Floating / overlay sidebar mode.
- A second collapsed level (e.g., fully hidden with hover-to-reveal).
- Customizing which nav items appear in the collapsed rail.
- Public landing pages — this is a dashboard-only feature.
