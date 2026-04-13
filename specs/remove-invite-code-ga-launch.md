---
title: Remove Invite Code Requirement (GA Launch)
status: implemented
priority: high
---

## Summary

The app is moving from invite-only beta to general availability. All invite code infrastructure — validation, token signing, UI input, API route, and tests — must be removed so that anyone can register via Google OAuth or email/password without a code.

## Acceptance Criteria

- [ ] New users can register via Google OAuth without any invite code or token
- [ ] New users can register via email/password without providing an invite code
- [ ] The login/register page no longer shows an invite code input field
- [ ] Visiting `/login?invite=anything` no longer auto-fills or switches to register view (param is ignored)
- [ ] `POST /api/auth/invite` route is removed (returns 404)
- [ ] `POST /api/auth/register` no longer validates an `inviteCode` field
- [ ] The `signIn` callback in `auth.ts` no longer checks for invite tokens on new Google sign-ups
- [ ] `src/lib/invite-codes.ts` is deleted
- [ ] `src/lib/__tests__/invite-codes.test.ts` is deleted
- [ ] Existing users are unaffected — login continues to work normally
- [ ] Trial subscription is still created for new users (both OAuth and email/password)
- [ ] CI passes: `npm run lint && npm run format:check && npm run build && npm run test`

## Technical Notes

Files to modify or delete:

- **Delete** `src/lib/invite-codes.ts` — hardcoded `INVITE_CODES` array + `createInviteToken`/`validateInviteToken`
- **Delete** `src/lib/__tests__/invite-codes.test.ts` — 15 tests for invite token logic
- **Delete** `src/app/api/auth/invite/route.ts` — POST route that sets `invite_token` cookie
- **Modify** `src/app/api/auth/register/route.ts` — remove `inviteCode` from request body validation and the check against `INVITE_CODES`
- **Modify** `src/lib/auth.ts` (`getAuthOptions`) — remove `inviteToken` parameter, remove token validation in `signIn` callback for new Google users. Keep trial subscription creation and Google account auto-linking logic intact.
- **Modify** `src/app/api/auth/[...nextauth]/route.ts` — remove `invite_token` cookie extraction and passing to `getAuthOptions()`
- **Modify** `src/app/(auth)/login/page.tsx` — remove `inviteCode` state, `?invite=` search param handling, invite code input field, and the `/api/auth/invite` call before Google sign-in. Remove the `error=invite_required` error message.
- **Update** `CLAUDE.md` — remove references to invite codes from the testing section (15 invite-code tests) and any other mentions

## Out of Scope

- Removing the `?invite=` param from any external links (marketing, emails) — they'll just be ignored
- Adding any replacement access control mechanism
- Changes to subscription/trial logic — new users still get a 30-day trial
- Database migrations — invite codes were never stored in the DB
