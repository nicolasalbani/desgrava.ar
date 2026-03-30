---
title: Subscription Plans with MercadoPago
status: implemented
priority: high
---

## Summary

Implement a subscription system using MercadoPago's Suscripciones (Preapproval) API so users must pay to use the platform after a 30-day free trial. New users get a trial period with full access, receive email reminders at 7 days and 1 day before expiry, and must subscribe to the Personal plan to continue. Existing users are grandfathered into a special "Founders" tier with full access at no cost. Users who cancel retain access until the end of their current billing period. Only the Personal plan is implemented for now.

## Acceptance Criteria

### Data Model

- [ ] New `Subscription` model tracks each user's subscription state: plan, status (TRIALING, ACTIVE, CANCELLED, PAST_DUE, EXPIRED), trial start/end dates, current period start/end, MercadoPago preapproval ID, and billing frequency (MONTHLY, ANNUAL)
- [ ] New `SubscriptionPlan` enum with values: PERSONAL, FOUNDERS
- [ ] New `SubscriptionStatus` enum with values: TRIALING, ACTIVE, CANCELLED, PAST_DUE, EXPIRED
- [ ] New `BillingFrequency` enum with values: MONTHLY, ANNUAL
- [ ] User model gains a relation to `Subscription` (one-to-one)
- [ ] Migration assigns existing users a FOUNDERS subscription with ACTIVE status and no expiry

### Free Trial

- [ ] New users automatically get a 30-day trial (status: TRIALING) upon account creation
- [ ] Trial end date is calculated as `createdAt + 30 days`
- [ ] During trial, users have full Personal-tier access
- [ ] Trial status is visible in the configuration page ("Tu prueba gratis vence el DD/MM/YYYY")

### Email Reminders

- [ ] Cron endpoint (`/api/cron/subscription-reminders`) sends reminder emails to trialing users at 7 days and 1 day before trial expiry
- [ ] Email at 7 days: friendly notice with CTA to subscribe
- [ ] Email at 1 day: urgent notice with CTA to subscribe
- [ ] Reminders tracked to prevent duplicate sends (e.g., `trialReminder7DaySentAt`, `trialReminder1DaySentAt` fields on Subscription)
- [ ] Cron endpoint is protected with `CRON_SECRET` (same pattern as existing `/api/cron/presentaciones`)

### MercadoPago Integration

- [ ] New `src/lib/mercadopago/` module with client initialization, preapproval creation, and webhook handling
- [ ] Two preapproval plans configured: monthly at $5,999 ARS and annual at $4,999/month ($59,988/year)
- [ ] Checkout flow: user clicks "Suscribirse" → API creates MercadoPago preapproval → user is redirected to MercadoPago's hosted checkout → returns to app with status
- [ ] Webhook endpoint (`/api/webhooks/mercadopago`) processes subscription lifecycle events: authorized, paused, cancelled, payment updates
- [ ] Webhook validates MercadoPago signature/source for security
- [ ] `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` added to required environment variables

### Access Control

- [ ] Middleware or layout-level check evaluates subscription status on every dashboard request
- [ ] Users with TRIALING (not expired), ACTIVE, or CANCELLED (within current period) status have full access
- [ ] Users with EXPIRED or PAST_DUE status get read-only access: can view all their data but cannot create/edit/delete invoices, upload PDFs, run automation jobs, or submit to ARCA
- [ ] FOUNDERS users always have full access regardless of any other condition
- [ ] Read-only mode shows a persistent banner: "Tu suscripción venció. Suscribite para seguir usando todas las funcionalidades."
- [ ] API routes enforce access control server-side (not just UI), returning 403 for write operations when expired

### Subscription Management UI (Configuration Page)

- [ ] New "Suscripción" card in `/configuracion` showing: current plan, status, billing frequency, next billing date, and amount
- [ ] For trialing users: shows trial end date and "Suscribirse" button with monthly/annual toggle
- [ ] For active users: shows next billing date and "Cancelar suscripción" button
- [ ] For cancelled users: shows "Acceso hasta DD/MM/YYYY" and option to re-subscribe
- [ ] For expired users: shows "Suscribirse" button prominently
- [ ] For founders: shows "Plan Founders — Acceso completo" with no billing details
- [ ] Cancel flow shows confirmation dialog explaining access continues until period end
- [ ] All new UI works on screens as narrow as 320px, using responsive breakpoints and mobile-first layout

### Landing Page

- [ ] "Empeza gratis" and "Proba 30 dias gratis" CTAs continue linking to `/login` (subscription is created on signup)
- [ ] Remove the separate "Gratis" tier card — the trial is part of the Personal plan flow, not a standalone tier

## Technical Notes

- **MercadoPago SDK**: Use the official `mercadopago` npm package. Initialize with `MERCADOPAGO_ACCESS_TOKEN`. Use the Preapproval API (`/preapproval`) for subscription creation and management.
- **Webhook security**: Validate incoming webhooks by checking the `x-signature` header or verifying the notification via MercadoPago's API (`/v1/payments/:id`).
- **Cron job**: Follow the existing pattern in `/api/cron/presentaciones` — protected by `CRON_SECRET` header, designed for Railway cron. Run daily.
- **Email templates**: Add `sendTrialReminderEmail(email, daysRemaining, subscribeUrl)` to `src/lib/email.ts` following the existing inline-HTML pattern with Resend.
- **Access control**: Implement as a shared utility `src/lib/subscription/access.ts` exporting `getUserAccess(userId): { canWrite: boolean, status, plan }`. Use in API routes and in the dashboard layout for the banner. Avoid middleware for DB calls — check in layout server components and API route handlers.
- **Founders migration**: Create a data migration that finds all existing users (before deployment) and creates a Subscription record with `plan: FOUNDERS, status: ACTIVE`. New users created after deployment get `plan: PERSONAL, status: TRIALING`.
- **Cancellation**: When a user cancels, update local status to CANCELLED and call MercadoPago's cancel preapproval API. The `currentPeriodEnd` field determines when access actually expires.
- **Pricing constants**: Define in `src/lib/subscription/plans.ts` to keep prices in sync between landing page, checkout, and management UI. Landing page pricing section should import from here.
- **Mobile-first**: Full-width subscription card on mobile, 44px minimum touch targets on CTAs, responsive layout using existing Tailwind breakpoints.

## Out of Scope

- Contadores plan (multi-CUIT, employee management tier)
- Payment history / invoice downloads from MercadoPago
- Proration when switching between monthly and annual
- Coupon or discount codes
- In-app payment form (we use MercadoPago's hosted checkout)
- Retry/dunning logic (handled by MercadoPago's managed subscriptions)
- Admin dashboard for managing subscriptions
- Webhook for payment failure notifications to user (rely on MercadoPago's built-in emails for now)
