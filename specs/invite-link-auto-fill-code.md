---
title: Invite Link with Auto-Fill Code
status: implemented
priority: medium
---

## Summary

Currently, invited users must manually type an invite code (e.g. "BETA2026") on the registration form. This feature adds support for shareable invite links like `/login?invite=BETA2026` that auto-fill the code and switch to the register view, removing friction from the onboarding flow.

## Acceptance Criteria

- [ ] Visiting `/login?invite=BETA2026` switches to the register view and pre-fills the invite code field
- [ ] The invite code field is read-only when pre-filled from the URL (user can clear it to type a different one)
- [ ] Invalid codes in the URL (e.g. `/login?invite=GARBAGE`) still show the register view with the code filled, but validation catches it on submit (no special error on page load)
- [ ] Google OAuth sign-in with `?invite=` param validates the code server-side via the existing `/api/auth/invite` flow before proceeding
- [ ] Direct registration (email/password) with a URL-provided code works identically to manually typed codes
- [ ] The `?invite=` param is preserved if the user switches between login/register views
- [ ] Existing manual code entry continues to work unchanged when no `?invite=` param is present

## Technical Notes

- Only the login page component (`src/app/(auth)/login/page.tsx`) needs changes — read `invite` from `useSearchParams()`, initialize `inviteCode` state and `view` from it.
- No new API routes needed — the existing `/api/auth/invite` (token creation) and `/api/auth/register` (code validation) handle the server-side checks.
- No changes to `invite-codes.ts`, `auth.ts`, or the invite token system — the URL simply carries the raw code that the form already accepts.
- The `?invite=` param uses the raw code (e.g. `BETA2026`), not the signed token. The signed token flow is only for Google OAuth cookie validation.

## Out of Scope

- Generating unique per-user invite links or tracking referrals
- Admin UI for managing invite codes
- Expiring or rate-limiting invite links (codes are already hardcoded in `INVITE_CODES`)
- Deep-link to registration from the landing page CTA (can be added later)
