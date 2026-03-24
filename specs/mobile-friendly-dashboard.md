---
title: Mobile-friendly dashboard
status: implemented
priority: high
---

## Summary

The dashboard is currently designed for desktop viewports. Tables with 7–9 columns force horizontal scrolling on mobile, dialogs have fixed max-widths that squeeze content, receipt forms use hardcoded 2-column grids that cramp on small screens, and layout padding doesn't adapt. This feature makes every dashboard page usable on phones without requiring horizontal scrolling.

## Acceptance Criteria

### Tables — card layout on mobile

- [ ] On screens below `md` (< 768px), the invoice table (`invoice-list.tsx`) renders as a vertical card list instead of a `<Table>`. Each card shows: provider name, amount, category badge, SiRADIG status badge, and an actions row. Checkbox for multi-select is a small toggle in the card corner.
- [ ] On screens below `md`, the receipt table (`receipt-list.tsx`) renders as a card list. Each card shows: worker name, period, total amount, SiRADIG status badge, and actions.
- [ ] On screens below `md`, the presentaciones table (`presentaciones-list.tsx`) renders as a card list. Each card shows: description, date, total amount, SiRADIG status, and PDF download link.
- [ ] On `md` and above, all three tables render as the current `<Table>` layout — no changes to desktop behavior.
- [ ] Card lists support the same selection, expand (job history), and action behaviors as the table rows.

### Dialogs — responsive widths

- [ ] All `DialogContent` components use `max-w-[95vw] sm:max-w-lg` (or `sm:max-w-2xl` for larger dialogs) so they fill mobile screens while remaining constrained on desktop.
- [ ] Affected dialogs: invoice form, invoice edit, file uploader, receipt form, receipt edit, all import-arca dialogs, submit-presentacion dialog, bulk-category popover.

### Forms — responsive grids

- [ ] `receipt-form.tsx` replaces hardcoded `grid-cols-2` with `grid-cols-1 md:grid-cols-2` on all grid layouts.
- [ ] All form dialogs that use 2-column grids have the `md:` breakpoint (verify `invoice-form.tsx` already does this — no change needed if so).

### Layout — responsive padding

- [ ] Main content area in `dashboard-shell.tsx` uses `p-4 md:p-6` instead of `p-6`.
- [ ] Form pages (`credenciales`, `configuracion`, `perfil`) use `w-full max-w-xl` so content fills mobile width naturally.

### Toolbar and filters — mobile stacking

- [ ] The invoice list toolbar (search + filters + actions) stacks vertically on mobile: search input takes full width, filter/action buttons wrap below.
- [ ] Same pattern for receipt list and presentaciones list toolbars.
- [ ] Popover filters use `w-auto min-w-[200px] max-w-[90vw]` to avoid overflow on mobile edges.

### Pagination — compact mobile layout

- [ ] `PaginationControls` uses a more compact layout on mobile: hides the "por página" label, keeps just the page selector and prev/next buttons.

## Technical Notes

### Card vs Table pattern

Use a shared approach: render `<Table>` inside a container with `hidden md:block`, and the card list inside a container with `md:hidden`. Both read from the same data source. The card layout uses simple `div` stacking with `border-b` separators — no new component library needed.

### Tailwind breakpoints

The project uses Tailwind CSS 4. The `md:` breakpoint (768px) is the primary mobile/desktop split. Use `sm:` (640px) only where finer control is needed (e.g., dialog widths).

### Dark mode

All new mobile styles must include `dark:` variants or use semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`) that auto-adapt. Follow existing dark mode patterns in the codebase.

### Files to modify

- `src/components/facturas/invoice-list.tsx` — Card layout for mobile
- `src/components/recibos/receipt-list.tsx` — Card layout for mobile
- `src/components/presentaciones/presentaciones-list.tsx` — Card layout for mobile
- `src/components/recibos/receipt-form.tsx` — Responsive grid
- `src/components/layout/dashboard-shell.tsx` — Responsive padding
- `src/app/(dashboard)/credenciales/page.tsx` — Full-width mobile
- `src/app/(dashboard)/configuracion/page.tsx` — Full-width mobile
- `src/app/(dashboard)/perfil/page.tsx` — Full-width mobile
- `src/components/shared/pagination-controls.tsx` — Compact mobile
- Dialog components across facturas, recibos, presentaciones — Responsive max-width

## Out of Scope

- Landing page / public pages — only dashboard routes
- Native mobile app or PWA features
- Touch gestures (swipe to delete, pull to refresh)
- Bottom navigation bar for mobile
- Redesigning the desktop table layout
- Changes to the simulador page (it's a public page)
