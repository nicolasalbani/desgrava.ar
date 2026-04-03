import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewTicketEmail } from "@/lib/email";
import OpenAI from "openai";
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_TOOLS } from "@/lib/soporte/system-prompt";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await req.json();
  const {
    messages,
    pageUrl,
    ticketId: existingTicketId,
  } = body as {
    messages: IncomingMessage[];
    pageUrl?: string;
    ticketId?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("messages is required", { status: 400 });
  }

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SUPPORT_SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // First call — may trigger tool use
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: openaiMessages,
    tools: SUPPORT_TOOLS,
    temperature: 0.7,
    max_tokens: 1000,
  });

  const choice = response.choices[0];
  if (!choice) {
    return Response.json({ error: "No response from AI" }, { status: 500 });
  }

  // Handle tool calls
  const toolCalls = choice.message.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const events: Array<{
      type: string;
      ticketId?: string;
      subject?: string;
      whatsappUrl?: string;
      summary?: string;
    }> = [];
    const toolResults: OpenAI.ChatCompletionMessageParam[] = [
      choice.message as OpenAI.ChatCompletionMessageParam,
    ];

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === "create_ticket") {
        const ticket = await prisma.supportTicket.create({
          data: {
            userId: session.user.id,
            subject: args.subject,
            description: args.description,
            pageUrl: pageUrl || null,
            conversationLog: JSON.parse(JSON.stringify(messages)),
          },
        });

        sendNewTicketEmail(
          ticket.id,
          args.subject,
          args.description,
          session.user.email ?? "unknown",
          pageUrl || null,
        ).catch((err) => console.error("Failed to send ticket notification:", err));

        events.push({
          type: "ticket_created",
          ticketId: ticket.id,
          subject: args.subject,
        });

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: true,
            ticketId: ticket.id,
            message: `Ticket creado con ID ${ticket.id}`,
          }),
        });
      } else if (toolCall.function.name === "offer_whatsapp") {
        const whatsappNumber = process.env.SUPPORT_WHATSAPP || "";
        const ticketEvent = events.find((e) => e.type === "ticket_created");
        const resolvedTicketId = ticketEvent?.ticketId || existingTicketId;
        let whatsappText = `Hola, necesito ayuda con desgrava.ar.\n\n${args.summary}`;
        if (resolvedTicketId) {
          whatsappText += `\n\nTicket: ${resolvedTicketId}`;
        }
        const whatsappUrl = whatsappNumber
          ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`
          : "";

        events.push({
          type: "whatsapp_offer",
          whatsappUrl,
          summary: args.summary,
        });

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: true,
            whatsappUrl,
          }),
        });
      }
    }

    // Second call — get the AI's response after tool execution
    const followUp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...openaiMessages, ...toolResults],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const followUpContent = followUp.choices[0]?.message?.content ?? "Lo siento, ocurrió un error.";

    return Response.json({
      content: followUpContent,
      events,
    });
  }

  // No tool calls — just return the text response
  return Response.json({
    content: choice.message.content ?? "Lo siento, ocurrió un error.",
    events: [],
  });
}
