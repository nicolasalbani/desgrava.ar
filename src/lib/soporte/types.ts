export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
