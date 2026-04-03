import { describe, it, expect } from "vitest";
import type {
  ChatMessage,
  TicketCreatedEvent,
  WhatsAppOfferEvent,
  SupportEvent,
} from "@/lib/soporte/types";

describe("soporte types", () => {
  it("should allow creating a user ChatMessage", () => {
    const msg: ChatMessage = { role: "user", content: "Hola" };
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hola");
  });

  it("should allow creating an assistant ChatMessage", () => {
    const msg: ChatMessage = {
      role: "assistant",
      content: "¿En qué puedo ayudarte?",
    };
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("¿En qué puedo ayudarte?");
  });

  it("should allow creating a TicketCreatedEvent", () => {
    const event: TicketCreatedEvent = {
      type: "ticket_created",
      ticketId: "abc123",
      subject: "Error al enviar factura",
    };
    expect(event.type).toBe("ticket_created");
    expect(event.ticketId).toBe("abc123");
  });

  it("should allow creating a WhatsAppOfferEvent", () => {
    const event: WhatsAppOfferEvent = {
      type: "whatsapp_offer",
      whatsappUrl: "https://wa.me/5491112345678?text=Hola",
      summary: "Problema con credenciales ARCA",
    };
    expect(event.type).toBe("whatsapp_offer");
    expect(event.whatsappUrl).toContain("wa.me");
  });

  it("should allow SupportEvent to be either type", () => {
    const events: SupportEvent[] = [
      { type: "ticket_created", ticketId: "abc", subject: "Test" },
      {
        type: "whatsapp_offer",
        whatsappUrl: "https://wa.me/123",
        summary: "Test",
      },
    ];
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("ticket_created");
    expect(events[1].type).toBe("whatsapp_offer");
  });
});
