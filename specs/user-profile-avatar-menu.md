---
title: User Profile Section & Avatar Menu
status: implemented
priority: medium
---

## Summary

Add a "Mi perfil" section at the top of the Configuración page where users can view and edit their profile picture (with circle crop), full name, and see their email (read-only). The header avatar becomes clickable, opening a dropdown menu with a link to the profile section and a logout action.

## Acceptance Criteria

### Avatar Dropdown Menu (Header)

- [ ] Clicking the avatar in `DashboardHeader` opens a `DropdownMenu` with:
  - User's name and email at the top (small, muted)
  - "Mi perfil" link → navigates to `/configuracion`
  - Divider
  - "Cerrar sesión" button (red text, same `signOut({ callbackUrl: "/" })` behavior)
- [ ] Remove the standalone logout button from the sidebar footer (`dashboard-sidebar.tsx`)
- [ ] Avatar dropdown works on both mobile and desktop
- [ ] On mobile, the avatar dropdown is the only way to access logout (sidebar hamburger no longer has it)

### Profile Section (Configuración Page)

- [ ] New `ProfileCard` component in `src/components/configuracion/`
- [ ] Positioned as the **first section** on the Configuración page, above Suscripción
- [ ] Displays:
  - **Profile picture**: Current avatar in a circle (96×96), with a hover overlay showing a camera/edit icon. Clicking opens the crop dialog.
  - **Nombre completo**: Editable text input, pre-filled from `user.name`. Saves on blur or Enter key via `PUT /api/perfil`.
  - **Email**: Read-only text, displayed with a lock icon or muted style to indicate it's not editable.
- [ ] If no profile picture is set, show the same initial-letter fallback used in the header avatar
- [ ] Save feedback: inline success toast on save, error toast on failure. Name input reverts to previous value on error.
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

### Image Crop & Upload

- [ ] Clicking the avatar opens a Dialog/modal with:
  - File picker (accept `image/*`) to select a new image
  - Circle crop view using `react-easy-crop`
  - Zoom slider
  - "Guardar" and "Cancelar" buttons
- [ ] After cropping, the image is resized client-side to max 256×256px and converted to a JPEG data URL (keeps payload small)
- [ ] The resulting data URL is sent to `PUT /api/perfil` and stored in the existing `user.image` field
- [ ] Crop dialog is responsive — full-width on mobile with adequate touch targets (44px min)

### API — Profile

- [ ] New `PUT /api/perfil` route — accepts `{ name?: string, image?: string }`, updates `user.name` and/or `user.image`
- [ ] Validate: `name` must be 1–100 characters if provided; `image` must be a data URL under 500KB if provided
- [ ] Protected via `getServerSession`
- [ ] New `GET /api/perfil` route — returns `{ name, email, image }` from the User record

### Session Sync

- [ ] After updating name or image, the NextAuth session reflects the change without requiring re-login (already handled by the session callback reading from DB)

## Technical Notes

- **Crop library**: Use `react-easy-crop` — lightweight, well-maintained, provides the classic circle crop with zoom. The cropped area output is used with a `<canvas>` to produce the final resized JPEG data URL client-side.
- **Image as data URL**: All resizing and format conversion happens client-side. The server receives a ready-to-store base64 data URL string (e.g. `data:image/jpeg;base64,...`). No server-side image processing or external storage needed. A 256×256 JPEG at 80% quality is typically 15–30KB. The 500KB validation limit is generous but prevents abuse.
- **Avatar dropdown**: Use shadcn's `DropdownMenu` (already available via Radix) — handles keyboard navigation and focus management out of the box.
- **Sidebar logout removal**: The logout action moves exclusively to the avatar dropdown. This is a common pattern (GitHub, Linear, etc.) and declutters the sidebar.
- **Existing `image` field**: The Prisma `User.image` field (`String?`) currently stores Google OAuth avatar URLs. Storing a data URL in the same field is transparent — the `<AvatarImage>` component already accepts any valid `src`.
- **Mobile**: Profile card uses single-column layout. Crop dialog is full-screen on mobile (`max-w-lg` on desktop). Zoom slider and buttons are touch-friendly (44px targets).

## Out of Scope

- **Email editing**: Email is read-only. Changing email would require re-verification flow.
- **Password change**: Not part of this feature — could be a separate Configuración section later.
- **Deleting account**: No account deletion flow.
- **External image storage** (S3, R2, etc.): Images are stored as data URLs in the DB for simplicity. Can be migrated to external storage later if needed.
- **Social avatar sync**: No automatic refresh of Google profile picture. Once a user uploads a custom image, it overrides the OAuth one.
