import { describe, it, expect } from "vitest";
import { claimsTicketCreationWithoutInvocation } from "@/lib/soporte/ticket-hallucination";

const NO_TICKET_YET = { ticketEventEmitted: false, conversationAlreadyHasTicket: false };

describe("claimsTicketCreationWithoutInvocation", () => {
  it("flags 'He creado el ticket' narration without invocation", () => {
    expect(
      claimsTicketCreationWithoutInvocation(
        "He creado el ticket para el problema. Si querés, podés escribirle al equipo por WhatsApp.",
        NO_TICKET_YET,
      ),
    ).toBe(true);
  });

  it("flags 'ticket creado' phrase", () => {
    expect(
      claimsTicketCreationWithoutInvocation("Listo, ticket creado correctamente.", NO_TICKET_YET),
    ).toBe(true);
  });

  it("flags 'voy a crear' narration", () => {
    expect(
      claimsTicketCreationWithoutInvocation(
        "Voy a crear el reporte para que el equipo lo revise.",
        NO_TICKET_YET,
      ),
    ).toBe(true);
  });

  it("flags 'ya lo reporté' even when phrased casually", () => {
    expect(
      claimsTicketCreationWithoutInvocation("Listo, ya lo reporté al equipo.", NO_TICKET_YET),
    ).toBe(true);
  });

  it("flags accent-less variants", () => {
    expect(
      claimsTicketCreationWithoutInvocation("Cree el ticket sin problemas.", NO_TICKET_YET),
    ).toBe(true);
  });

  it("does NOT flag when the ticket_created event was emitted this turn", () => {
    expect(
      claimsTicketCreationWithoutInvocation("Listo, ticket creado.", {
        ticketEventEmitted: true,
        conversationAlreadyHasTicket: false,
      }),
    ).toBe(false);
  });

  it("does NOT flag when the conversation already has a ticket from a previous turn", () => {
    expect(
      claimsTicketCreationWithoutInvocation("Como te dije antes, el ticket ya está creado.", {
        ticketEventEmitted: false,
        conversationAlreadyHasTicket: true,
      }),
    ).toBe(false);
  });

  it("does NOT flag innocuous answers", () => {
    expect(
      claimsTicketCreationWithoutInvocation(
        "¿Querés que te explique cómo funciona el simulador?",
        NO_TICKET_YET,
      ),
    ).toBe(false);
  });

  it("does NOT flag the warning sentence on its own (no creation claim)", () => {
    expect(
      claimsTicketCreationWithoutInvocation(
        "Tu reporte se va a compartir con el equipo de desarrollo.",
        NO_TICKET_YET,
      ),
    ).toBe(false);
  });

  it("does NOT flag empty content", () => {
    expect(claimsTicketCreationWithoutInvocation("", NO_TICKET_YET)).toBe(false);
  });
});
