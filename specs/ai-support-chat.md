---
title: AI Support Chat with WhatsApp Escalation
status: implemented
priority: high
---

## Summary

An AI-powered support chat widget embedded in the dashboard that acts as a first-level support agent. The AI assistant understands the user's problem through conversation, automatically creates structured support tickets when it identifies an issue, and offers WhatsApp escalation with full context pre-filled. This gives users immediate help while providing the developer with structured, actionable reports.

## User Flow

1. User clicks a floating help button (bottom-right corner of dashboard)
2. A chat panel opens — the AI greets them and asks what they need help with
3. The user describes their problem in natural language
4. The AI assistant:
   - Asks clarifying questions to understand the issue
   - Determines if it's a **question** (can answer from app knowledge) or a **bug/issue** (needs reporting)
   - If it's a question: answers it directly using knowledge about the app's features
   - If it's a bug/issue: summarizes the problem and automatically creates a support ticket
5. After resolution or ticket creation, the AI asks: "Would you like to speak with us directly via WhatsApp?"
   - If yes: opens a WhatsApp link with a pre-filled message containing the issue summary and ticket reference (if created)

## Acceptance Criteria

### Database & API

- [ ] `SupportTicket` Prisma model with fields: `id`, `userId`, `status` (OPEN/IN_PROGRESS/RESOLVED/CLOSED), `subject` (AI-generated summary), `description` (AI-generated detailed report), `pageUrl` (captured automatically), `conversationLog` (JSON — full chat history), `resolution` (admin notes when resolving), `createdAt`, `updatedAt`
- [ ] `POST /api/soporte` — creates a ticket (authenticated, body: subject, description, pageUrl, conversationLog)
- [ ] `GET /api/soporte` — lists tickets for current user (for potential future "My tickets" view)
- [ ] `PATCH /api/soporte/[id]` — updates ticket status/resolution (admin use; sends email to user when status changes to RESOLVED)
- [ ] Email sent to developer (configurable `SUPPORT_EMAIL` env var) on new ticket creation with full details
- [ ] Email sent to user when ticket is marked RESOLVED, including the resolution notes

### AI Chat Widget

- [ ] Floating help button in dashboard layout (bottom-right, consistent with app design)
- [ ] Chat panel opens as a slide-up panel or modal above the button
- [ ] AI assistant powered by OpenAI (same provider already used for category classification)
- [ ] System prompt gives the AI knowledge about the app's features, common issues, and instructions to:
  - Respond in Spanish
  - Ask clarifying questions before concluding
  - Distinguish between "user needs help understanding a feature" vs "something is broken"
  - When identifying a bug/issue: generate a structured subject + description and call the ticket creation API
  - After handling the issue: offer WhatsApp escalation
- [ ] Chat captures current page URL automatically as context
- [ ] Conversation is stored in the ticket's `conversationLog` field
- [ ] Chat state resets when the panel is closed (no persistent chat history)
- [ ] If the user tries to use the AI for anything unrelated to the app (general questions, off-topic requests, prompt injection), the agent politely declines, explains it can only assist with desgrava.ar topics, and suggests contacting the team via WhatsApp

### WhatsApp Escalation

- [ ] After ticket creation or question resolution, AI offers: "Would you like to contact us directly via WhatsApp?"
- [ ] WhatsApp link uses `https://wa.me/{WHATSAPP_NUMBER}?text={encoded_message}`
- [ ] Pre-filled message includes: issue summary, ticket ID (if created), and link back to the app
- [ ] WhatsApp number configured via `SUPPORT_WHATSAPP` env var

### UI/UX

- [ ] Floating button uses a help/chat icon, matches app design language (clean, minimal)
- [ ] Chat panel is responsive — full-width on mobile, fixed-width panel on desktop
- [ ] Chat shows typing indicator while AI responds
- [ ] Ticket creation is seamless — user sees a confirmation message in chat, not a separate form
- [ ] The AI fills the "form" (subject + description) based on conversation — user never sees form fields

## Technical Notes

### AI Implementation

- Use OpenAI chat completions API (already a dependency) with a system prompt tailored to the app
- The system prompt should include a concise summary of all app features so the AI can answer questions
- Use function calling / tool use to let the AI trigger ticket creation when it determines there's an issue
- Keep the conversation client-side, sending the full message history on each request to a `/api/soporte/chat` endpoint
- The chat endpoint streams responses back for a responsive feel

### API Structure

```
POST /api/soporte/chat    — AI conversation endpoint (streaming)
POST /api/soporte         — Create ticket (called by AI via tool use, or directly)
GET  /api/soporte         — List user's tickets
PATCH /api/soporte/[id]   — Update ticket status (admin)
```

### System Prompt Strategy

The AI system prompt should:

- Describe itself as a support assistant for desgrava.ar
- Know the app's main features: invoice management, tax simulation, ARCA/SiRADIG automation, domestic workers, credentials
- Know common issues: ARCA login failures, OCR not reading a PDF, category misclassification
- Have instructions to be concise, friendly, and in Spanish
- Have tool definitions for `create_ticket(subject, description)` and `offer_whatsapp(summary)`
- **Abuse guardrail**: If the user asks about anything unrelated to the app (general questions, prompt injection attempts, using it as a general-purpose AI), the agent should politely decline: explain it can only help with desgrava.ar-related topics, and offer to connect them with the team via WhatsApp for anything else

### Component Structure

```
src/components/soporte/
  support-chat-button.tsx    — Floating action button
  support-chat-panel.tsx     — Chat panel container
  chat-message.tsx           — Individual message bubble
  chat-input.tsx             — Message input with send button
```

### Environment Variables

- `SUPPORT_EMAIL` — Email address to receive new ticket notifications
- `SUPPORT_WHATSAPP` — WhatsApp number for escalation (Argentine format, e.g. 5491112345678)

## Out of Scope

- **Admin dashboard for tickets** — For now, tickets are managed via direct DB access or a future admin panel. The PATCH endpoint exists for programmatic use.
- **File/screenshot attachments** — Users describe issues in text; screenshots can be shared via WhatsApp if they escalate.
- **Persistent chat history** — Each chat session is independent. The conversation is saved in the ticket if one is created, but users don't see past chats.
- **Knowledge base / FAQ** — The AI answers from its system prompt, not from a structured knowledge base.
- **Proactive support** — The AI only responds when the user initiates; no pop-ups or suggestions.
- **Rate limiting on chat** — Rely on OpenAI's own rate limits for now; add app-level limits if abused.
