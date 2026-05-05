export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  events?: SupportEvent[];
}

export interface TicketCreatedEvent {
  type: "ticket_created";
  ticketId: string;
  subject: string;
}

export interface WhatsAppOfferEvent {
  type: "whatsapp_offer";
  whatsappUrl: string;
  summary: string;
}

export type SupportEvent = TicketCreatedEvent | WhatsAppOfferEvent;

export interface ConversationSummary {
  id: string;
  title: string | null;
  preview: string | null;
  lastMessageAt: string;
  createdAt: string;
  hasTicket: boolean;
}
