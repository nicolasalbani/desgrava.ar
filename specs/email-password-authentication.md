---
title: Email/Password Authentication
status: implemented
priority: high
---

## Summary

Add email/password login as an alternative to Google OAuth, so users can sign in with either method (or both). Accounts are linked by email — a user who signs up with Google can later set a password, and a user who signs up with email/password can later link Google. New email/password registrations still require an invite code. Includes email verification (required before first login) and password reset via Resend.

## Acceptance Criteria

### Registration

- [ ] Login page shows two options: "Continuar con Google" (existing) and a new email/password form with fields for email, password, and invite code
- [ ] Password requirements: minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
- [ ] Real-time password complexity feedback below the password field showing each requirement as a checklist — each rule turns green as it's met
- [ ] Password field includes a show/hide toggle (eye icon)
- [ ] Submit button is disabled until all password requirements are met
- [ ] After registration, a verification email is sent via Resend with a secure token link
- [ ] User cannot log in until email is verified — show clear message: "Verificá tu email para continuar"
- [ ] Clicking the verification link marks the email as verified and redirects to `/login` with a success message

### Login

- [ ] Existing users can log in with email + password (only if email is verified)
- [ ] Existing users can still log in with Google OAuth (unchanged)
- [ ] Invalid credentials show a generic error: "Email o contraseña incorrectos" (don't reveal which is wrong)
- [ ] A user who registered with Google and has no password sees a helpful error suggesting Google login or password reset

### Account Linking

- [ ] If a user signs up with email/password and later signs in with Google using the same email, the Google account is linked to the existing user (same `User` record)
- [ ] If a user signed up with Google and wants to add a password, they can use the "Olvidé mi contraseña" flow to set one
- [ ] A user with both methods linked can log in with either

### Password Reset

- [ ] Login page has an "Olvidé mi contraseña" link
- [ ] Entering an email sends a password reset email via Resend with a secure time-limited token (1 hour expiry)
- [ ] If the email doesn't exist, still show success message (don't leak whether email exists)
- [ ] Reset link leads to a page where the user sets a new password with the same complexity requirements and real-time feedback as registration
- [ ] After successful reset, redirect to `/login` with a success message
- [ ] Using a reset link also verifies the email if it wasn't already verified

### Security

- [ ] Passwords are hashed with bcrypt (cost factor 12)
- [ ] Verification and reset tokens are cryptographically random, single-use, and time-limited
- [ ] Reset tokens expire after 1 hour; verification tokens expire after 24 hours
- [ ] Rate-limit sensitive endpoints: registration (5/min per IP), password reset requests (3/min per IP), login attempts (10/min per IP)

## Technical Notes

- **NextAuth Credentials provider**: Add `CredentialsProvider` alongside the existing `GoogleProvider` in `src/lib/auth.ts`. The `authorize` function validates email + password + verified status.
- **Session strategy**: Already using `"jwt"` — credentials provider requires this, so no change needed.
- **Password storage**: Add `passwordHash String?` to the `User` model in `prisma/schema.prisma`. Nullable because Google-only users won't have one.
- **Password validation**: Create a Zod schema in `src/lib/validators/password.ts` that enforces: min 8 chars, at least one uppercase (`/[A-Z]/`), one lowercase (`/[a-z]/`), one digit (`/[0-9]/`), one special char (`/[^A-Za-z0-9]/`). Share this schema between client (for real-time feedback) and server (for validation).
- **Password complexity UI**: Create a `PasswordStrengthIndicator` component in `src/components/auth/` that takes the current password value and renders a checklist of 5 rules, each with a green check or gray dot. Use it in both the registration form and the reset-password form.
- **Email verification**: `emailVerified DateTime?` already exists on `User`. Use the existing `VerificationToken` model (already in schema) for both email verification and password reset tokens, distinguishing by a prefix or separate identifier patterns.
- **Account linking in `signIn` callback**: The existing callback checks for existing users by email. For Google sign-in, if a user exists (registered via credentials) but has no linked Google `Account`, create the Account link automatically.
- **Resend integration**: Add `resend` package. New env var `RESEND_API_KEY`. Create `src/lib/email.ts` with functions: `sendVerificationEmail(email, token)` and `sendPasswordResetEmail(email, token)`.
- **New API routes**:
  - `POST /api/auth/register` — validate invite code, validate password complexity, create user with hashed password, send verification email
  - `GET /api/auth/verify-email?token=xxx` — verify token, set `emailVerified`, redirect to login
  - `POST /api/auth/forgot-password` — generate reset token, send email
  - `POST /api/auth/reset-password` — validate token, validate password complexity, update `passwordHash`
- **New pages**:
  - Update `src/app/(auth)/login/page.tsx` — add credentials form + "Olvidé mi contraseña" link
  - `src/app/(auth)/verify-email/page.tsx` — handles verification token from email link
  - `src/app/(auth)/reset-password/page.tsx` — new password form with complexity indicator after clicking reset link
- **Rate limiting**: Use an in-memory rate limiter (e.g., simple Map with TTL) for the auth endpoints. No need for Redis at current scale.
- **Naming**: All user-facing strings in Spanish. Code in English per project conventions.

## Out of Scope

- Magic link (passwordless email) login
- Two-factor authentication (2FA)
- Social login providers other than Google (e.g., GitHub, Apple)
- Account settings page for changing password or managing linked accounts (can be a follow-up)
- Admin-side user management
- Custom email templates with branding (use simple text/HTML for now)
- Password strength meter/score (e.g., zxcvbn) — only checklist-based validation
