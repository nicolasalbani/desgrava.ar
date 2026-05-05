---
title: Persistent Support Conversations with Ganancio
status: implemented
priority: medium
---

## Summary

The AI support chat currently resets every time the user closes the panel — no history, no way to revisit a thread or continue where they left off. This feature persists every chat as a `SupportConversation`, lets the user navigate and resume past chats from inside the chat panel, and rebrands the bot as **Ganancio** (the same character used in the onboarding tour) so the support assistant has a consistent, friendly identity across the product. A `SupportTicket` becomes an optional escalation hanging off a conversation, instead of being the only place a chat is stored.

## Acceptance Criteria

### Database

- [ ] New `SupportConversation` Prisma model: `id`, `userId`, `title` (nullable, AI-generated), `pageUrl` (latest known), `messages` (JSON — full ordered `[{role, content, events?}]` array), `createdAt`, `updatedAt`, `lastMessageAt` (indexed for sorting)
- [ ] Index `@@index([userId, lastMessageAt])` for the conversations list query
- [ ] `SupportTicket` gains an optional `conversationId String? @unique` with `conversation SupportConversation? @relation(... onDelete: SetNull)` (1:1 — a conversation has at most one ticket)
- [ ] `SupportConversation` cascades on user deletion (`onDelete: Cascade`)
- [ ] Data migration: existing `SupportTicket` rows are backfilled into `SupportConversation` rows using their existing `conversationLog` and `pageUrl`, and the new ticket→conversation FK is set so old tickets show up in the user's history

### Chat API

- [ ] `POST /api/soporte/chat` accepts an optional `conversationId` instead of the current `ticketId`. When omitted, a new `SupportConversation` is created on the first turn; when present, that conversation is appended to. Response always includes the resolved `conversationId` so the client can reuse it
- [ ] Each chat round-trip atomically appends the user message + assistant message (and any events) to `SupportConversation.messages` and bumps `lastMessageAt` and `pageUrl`. Persistence is server-driven — the client no longer holds the canonical history
- [ ] When OpenAI is called for a continued conversation, the full stored message history is replayed as the input (system prompt + persisted messages). Cap at the most recent 40 turns to keep the prompt bounded; older turns stay in the DB but are dropped from the model context
- [ ] AI-generated title: after the conversation reaches 4 messages and `title` is null, the chat route makes a separate cheap OpenAI call (gpt-4o-mini, ~50 tokens) asking for a 4–6 word Spanish title summarizing the topic, and writes it back to `SupportConversation.title`. Fire-and-forget (non-blocking on the user-facing response). On failure, leave `title` null and retry on the next turn
- [ ] When the AI calls `create_ticket`, the new `SupportTicket` is linked to the active conversation via `conversationId`. If the conversation already has a ticket, the AI tool returns `{ success: false, message: "Ya existe un ticket para esta conversación. Iniciá una nueva conversación si querés reportar otro problema." }` — the system prompt is updated to instruct Ganancio to suggest "Nueva conversación" in that case
- [ ] `GET /api/soporte/conversaciones` — returns the current user's conversations ordered by `lastMessageAt DESC`, projecting `id`, `title`, `lastMessageAt`, `createdAt`, the last assistant message preview (first ~80 chars), and `hasTicket` (boolean derived from the relation)
- [ ] `GET /api/soporte/conversaciones/[id]` — returns one conversation's full `messages` array; 404 if not owned by the session user

### Chat panel UI

- [ ] Panel header gains a left-side hamburger/list icon. Clicking it slides in (or replaces) a "Conversaciones" view showing the conversations list
- [ ] Conversations list shows: title (or "Conversación sin título" fallback), last assistant preview, relative date (`Hace 2 días`, `Ayer`, `Hoy 14:32` — simple `Intl.RelativeTimeFormat`), and a small ticket badge when `hasTicket` is true
- [ ] Tapping a conversation loads its messages (`GET /api/soporte/conversaciones/[id]`) into the chat view; subsequent sends pass that `conversationId` to `/api/soporte/chat` so the thread continues
- [ ] "Nueva conversación" button (header icon + empty-state CTA in the list) clears the active `conversationId` and shows the greeting; the next send creates a fresh conversation row
- [ ] When the panel closes, the active `conversationId` is preserved in component state for the session, so reopening the panel returns the user to the same thread (instead of resetting to the greeting). State is dropped on full page reload — no localStorage persistence needed
- [ ] The greeting message shown in a brand-new conversation reads `"Hola {firstName}, soy Ganancio, tu asistente de desgrava.ar. ¿En qué puedo ayudarte?"`. `firstName` comes from the session user's display name (split on first whitespace); if unavailable, drop the comma and name segment
- [ ] All new UI works on screens as narrow as 320px: list and chat views fill the panel width, the back-from-list affordance is a 44px touch target, the floating panel keeps its existing `w-[calc(100vw-2rem)]` mobile sizing

### Ganancio branding

- [ ] Replace the `MessageCircle` lucide icon used as the assistant avatar in `src/components/soporte/chat-message.tsx` (assistant message bubble) and `src/components/soporte/support-chat-panel.tsx` (typing indicator) with the existing `/ganancio.png` portrait, rendered inside a circular `bg-primary` container at the same size (`size-7` for messages, slightly larger if visually warranted), via Next.js `<Image>` for optimization
- [ ] The floating launcher button (`SupportChatButton`) keeps its current generic `MessageCircleQuestion` lucide icon — out of scope for the rebrand
- [ ] System prompt in `src/lib/soporte/system-prompt.ts` is updated so Ganancio refers to himself by name when relevant (greetings, sign-offs) and continues to respond in Spanish

### Tests

- [ ] Update existing `src/lib/soporte/__tests__/system-prompt.test.ts` for the new self-identification + "ya existe un ticket" guidance
- [ ] New `src/lib/soporte/__tests__/conversation-title.test.ts` covering the title-generation trigger threshold (skip when <4 messages, skip when title already set, run otherwise) — pure helper extracted from the chat route

## Technical Notes

### Schema migration

```prisma
model SupportConversation {
  id            String   @id @default(cuid())
  userId        String
  title         String?
  pageUrl       String?
  messages      Json     @default("[]")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastMessageAt DateTime @default(now())

  user   User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  ticket SupportTicket?

  @@index([userId, lastMessageAt])
}

model SupportTicket {
  ...existing fields...
  conversationId String?              @unique
  conversation   SupportConversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
}
```

Run a follow-up data migration (Prisma `migrate dev` SQL or a small one-off script) that:

1. For each existing `SupportTicket`, creates a `SupportConversation` row with `messages = ticket.conversationLog`, `pageUrl = ticket.pageUrl`, `lastMessageAt = ticket.updatedAt`, `userId = ticket.userId`.
2. Sets `SupportTicket.conversationId = newConversation.id`.

The `conversationLog` field on `SupportTicket` can stay for now — out of scope to remove it (we have ~zero paid users so it's not load-bearing, but cleanup is a separate task).

### Client state

Move the canonical `messages` array out of `SupportChatPanel` component state and into a `useConversation(conversationId)` hook backed by the API. The hook exposes `{ messages, send(text), startNewConversation(), loadConversation(id), conversations }` and handles optimistic appends + error rollback. Keeps the component thin.

### Mobile-first layout

Design at 320px first, then enhance. The existing `bg-background fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] flex-col … sm:w-[400px]` panel sizing already supports mobile — extend the same approach to the conversations list (full-width inside the panel, scrollable, no horizontal overflow). Touch targets in the list (each row, the back affordance, "Nueva conversación") must be ≥44px tall.

### Avatar component

Extract a small `<GanancioAvatar size="sm" | "md" />` component in `src/components/soporte/ganancio-avatar.tsx` so the message bubble, typing indicator, and any future surface stay visually consistent. Internally uses `next/image` with `priority={false}` and a small fixed pixel size to avoid layout shift inside the chat scroll area.

### System prompt update

In `src/lib/soporte/system-prompt.ts`:

- Change the assistant identity line to reference "Ganancio" so self-references are consistent.
- Add a one-liner: when the active conversation already has a ticket, decline to create another and tell the user to start "Nueva conversación".
- The greeting copy itself lives in the **client** (so we can interpolate `firstName` without round-tripping the session) — the system prompt should not duplicate it.

### Title generation

Pure helper in `src/lib/soporte/conversation-title.ts`:

```ts
export function shouldGenerateTitle(messageCount: number, currentTitle: string | null): boolean {
  return currentTitle === null && messageCount >= 4;
}
```

Called from the chat route after each turn; when true, fire-and-forget an OpenAI call with a tiny prompt (`"Resumí esta conversación de soporte en 4 a 6 palabras en español, sin comillas:"` + the user/assistant messages joined). Persist via `prisma.supportConversation.update`. Errors are swallowed (logged but not surfaced).

### History truncation for OpenAI context

When replaying messages into OpenAI, take the last 40 turns from the persisted array — older messages stay in the DB and are still rendered in the UI, but don't go into the model prompt. Keep this constant near the chat route (not the system prompt module) since it's an infra concern.

## Out of Scope

- **Searching past conversations** — list is chronological only; full-text search across messages is a future enhancement.
- **Deleting conversations from the UI** — admin/DB only for now (keeps audit trail clean for any associated tickets).
- **Editing or branching past conversations** — sending a message in an old chat appends to the same thread; there is no "fork from this point".
- **Cross-device sync indicator** — conversations are already persisted per-user, so they appear across devices automatically; no explicit sync UI.
- **Replacing the floating launcher icon with Ganancio** — explicitly kept generic per scoping decision.
- **Renaming or removing `SupportTicket.conversationLog`** — left in place to avoid a destructive migration; can be cleaned up separately once the new model is settled.
- **Push/email notifications when an admin replies** — current resolution-email flow is unchanged; surfacing replies inside the chat panel is future work.
- **Streaming responses** — response shape stays as-is (POST → JSON); switching to streaming is orthogonal.
- **Limit on number of conversations per user** — no quota enforcement in this iteration.
