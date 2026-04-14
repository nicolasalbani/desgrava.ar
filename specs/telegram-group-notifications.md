---
title: Telegram Group Notifications
status: implemented
priority: medium
---

## Summary

Integrate with the Telegram Bot API to send real-time notifications to a Telegram group whenever a new user creates an account (email/password or Google OAuth) or a support ticket is created. This gives the team instant visibility into user growth and support requests without checking email.

## Acceptance Criteria

- [ ] A new `src/lib/telegram.ts` module sends messages to a Telegram group via the Bot API (`POST https://api.telegram.org/bot<token>/sendMessage`)
- [ ] When a user registers via email/password (`POST /api/auth/register`), a Telegram notification is sent with the user's email and auth method ("Email/Contraseña")
- [ ] When a user signs up via Google OAuth (NextAuth `signUp` trigger in `jwt` callback), a Telegram notification is sent with the user's email and auth method ("Google")
- [ ] When a support ticket is created (`POST /api/soporte`), a Telegram notification is sent with: ticket ID, subject, description (truncated to 500 chars), user email, page URL (if present), and automation job ID (if present)
- [ ] Telegram notifications are fire-and-forget (non-blocking) — failures are logged but never break the main flow
- [ ] If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` env vars are missing, Telegram notifications are silently skipped (no errors)
- [ ] Messages use Telegram's MarkdownV2 formatting for readability (bold labels, monospace for IDs)
- [ ] Tests cover: message formatting, graceful skip when env vars are missing, error handling on API failure

## Technical Notes

- **Telegram Bot setup**: Create a bot via @BotFather, add it to the target group, and retrieve the chat ID. Store as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars.
- **Module**: Create `src/lib/telegram.ts` following the same pattern as `src/lib/email.ts` — a module with exported async functions (`sendNewUserNotification`, `sendNewTicketNotification`) that use `fetch` to call the Telegram Bot API. No SDK needed — the Bot API is a single HTTP POST.
- **Registration hook (email/password)**: Call `sendNewUserNotification` in `src/app/api/auth/register/route.ts` after user creation, same fire-and-forget pattern as `sendVerificationEmail`.
- **Registration hook (Google OAuth)**: Call `sendNewUserNotification` in the `jwt` callback in `src/lib/auth.ts` when `trigger === "signUp"`. The user's email is available from `token.email`.
- **Support ticket hook**: Call `sendNewTicketNotification` in `src/app/api/soporte/route.ts` after ticket creation, alongside the existing `sendNewTicketEmail` call.
- **MarkdownV2 escaping**: Telegram's MarkdownV2 requires escaping special characters (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`). The module should include a helper to escape user-provided strings.
- **No DB changes needed** — this is purely a notification integration with no persistence.
- **Update `CLAUDE.md`** to document the new env vars and `src/lib/telegram.ts` module.

## Out of Scope

- Telegram bot commands or interactive features (this is one-way notifications only)
- Notification preferences or admin UI to configure the Telegram group
- Notifications for other events (subscription changes, automation jobs, etc.)
- Rate limiting for Telegram API calls (the volume of signups/tickets is low enough)
