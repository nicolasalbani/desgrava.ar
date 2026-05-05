import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewTicketEmail } from "@/lib/email";
import OpenAI from "openai";
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_TOOLS, JOB_TYPE_LABELS } from "@/lib/soporte/system-prompt";
import { generateConversationTitle, shouldGenerateTitle } from "@/lib/soporte/conversation-title";
import type { ChatMessage, SupportEvent } from "@/lib/soporte/types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const MAX_HISTORY_TURNS = 40;

function formatJobForAI(job: {
  id: string;
  jobType: string;
  errorMessage: string | null;
  currentStep: string | null;
  fiscalYear: number | null;
  createdAt: Date;
  invoice: { providerName: string | null; providerCuit: string } | null;
  domesticReceipts: Array<{
    periodo: string;
    domesticWorker: { apellidoNombre: string } | null;
  }>;
  presentacion: { descripcion: string } | null;
  employer: { razonSocial: string } | null;
}): {
  id: string;
  type: string;
  typeLabel: string;
  relatedEntity: string | null;
  fiscalYear: number | null;
  failedAtStep: string | null;
  error: string | null;
  date: string;
} {
  let relatedEntity: string | null = null;

  if (job.invoice) {
    relatedEntity = job.invoice.providerName || job.invoice.providerCuit;
  } else if (job.domesticReceipts.length > 0) {
    const receipt = job.domesticReceipts[0];
    relatedEntity = receipt.domesticWorker
      ? `${receipt.domesticWorker.apellidoNombre} — ${receipt.periodo}`
      : receipt.periodo;
  } else if (job.presentacion) {
    relatedEntity = job.presentacion.descripcion;
  } else if (job.employer) {
    relatedEntity = job.employer.razonSocial;
  }

  return {
    id: job.id,
    type: job.jobType,
    typeLabel: JOB_TYPE_LABELS[job.jobType] || job.jobType,
    relatedEntity,
    fiscalYear: job.fiscalYear,
    failedAtStep: job.currentStep,
    error: job.errorMessage,
    date: job.createdAt.toISOString(),
  };
}

async function resolveAutomationJobId(
  jobId: string | undefined | null,
  userId: string,
): Promise<string | null> {
  if (!jobId) return null;
  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  });
  return job?.id ?? null;
}

interface ToolEvent {
  type: string;
  ticketId?: string;
  subject?: string;
  whatsappUrl?: string;
  summary?: string;
}

async function handleToolCall(
  toolCall: OpenAI.ChatCompletionMessageToolCall,
  userId: string,
  userEmail: string,
  pageUrl: string | null,
  conversationId: string,
  events: ToolEvent[],
): Promise<OpenAI.ChatCompletionToolMessageParam | null> {
  if (toolCall.type !== "function") return null;
  const args = JSON.parse(toolCall.function.arguments);

  if (toolCall.function.name === "create_ticket") {
    const existingTicket = await prisma.supportTicket.findUnique({
      where: { conversationId },
      select: { id: true },
    });
    if (existingTicket) {
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          success: false,
          message:
            "Ya existe un ticket para esta conversación. Iniciá una nueva conversación si querés reportar otro problema.",
          existingTicketId: existingTicket.id,
        }),
      };
    }

    const automationJobId = await resolveAutomationJobId(args.automation_job_id, userId);

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { messages: true },
    });
    const messagesForLog = (conversation?.messages as unknown as ChatMessage[]) ?? [];

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: args.subject,
        description: args.description,
        pageUrl,
        conversationLog: JSON.parse(JSON.stringify(messagesForLog)),
        automationJobId,
        conversationId,
      },
    });

    sendNewTicketEmail(
      ticket.id,
      args.subject,
      args.description,
      userEmail,
      pageUrl,
      automationJobId,
    ).catch((err) => console.error("Failed to send ticket notification:", err));

    events.push({
      type: "ticket_created",
      ticketId: ticket.id,
      subject: args.subject,
    });

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: true,
        ticketId: ticket.id,
        message: `Ticket creado con ID ${ticket.id}`,
      }),
    };
  }

  if (toolCall.function.name === "offer_whatsapp") {
    const whatsappNumber = process.env.SUPPORT_WHATSAPP || "";
    const ticketEvent = events.find((e) => e.type === "ticket_created");
    let resolvedTicketId = ticketEvent?.ticketId;
    if (!resolvedTicketId) {
      const existingTicket = await prisma.supportTicket.findUnique({
        where: { conversationId },
        select: { id: true },
      });
      resolvedTicketId = existingTicket?.id;
    }
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

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: true,
        whatsappUrl,
      }),
    };
  }

  if (toolCall.function.name === "lookup_failed_automations") {
    const failedJobs = await prisma.automationJob.findMany({
      where: { userId, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        invoice: { select: { providerName: true, providerCuit: true } },
        domesticReceipts: {
          select: {
            periodo: true,
            domesticWorker: { select: { apellidoNombre: true } },
          },
        },
        presentacion: { select: { descripcion: true } },
        employer: { select: { razonSocial: true } },
      },
    });

    const formattedJobs = failedJobs.map(formatJobForAI);

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: true,
        count: formattedJobs.length,
        jobs: formattedJobs,
      }),
    };
  }

  return null;
}

function toEvents(toolEvents: ToolEvent[]): SupportEvent[] {
  const events: SupportEvent[] = [];
  for (const e of toolEvents) {
    if (e.type === "ticket_created" && e.ticketId && e.subject) {
      events.push({ type: "ticket_created", ticketId: e.ticketId, subject: e.subject });
    } else if (e.type === "whatsapp_offer" && e.summary) {
      events.push({
        type: "whatsapp_offer",
        whatsappUrl: e.whatsappUrl ?? "",
        summary: e.summary,
      });
    }
  }
  return events;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await req.json();
  const {
    message,
    conversationId: incomingConversationId,
    pageUrl,
  } = body as {
    message?: string;
    conversationId?: string;
    pageUrl?: string;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return new Response("message is required", { status: 400 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? "unknown";
  const resolvedPageUrl = pageUrl || null;

  // Load or create the conversation
  let conversation: {
    id: string;
    title: string | null;
    messages: ChatMessage[];
  };

  if (incomingConversationId) {
    const existing = await prisma.supportConversation.findFirst({
      where: { id: incomingConversationId, userId },
      select: { id: true, title: true, messages: true },
    });
    if (!existing) {
      return new Response("Conversación no encontrada", { status: 404 });
    }
    conversation = {
      id: existing.id,
      title: existing.title,
      messages: (existing.messages as unknown as ChatMessage[]) ?? [],
    };
  } else {
    const created = await prisma.supportConversation.create({
      data: {
        userId,
        pageUrl: resolvedPageUrl,
        messages: [],
      },
      select: { id: true, title: true, messages: true },
    });
    conversation = {
      id: created.id,
      title: created.title,
      messages: [],
    };
  }

  const userMessage: ChatMessage = { role: "user", content: message };
  const historyWithUser = [...conversation.messages, userMessage];
  const trimmedForModel = historyWithUser.slice(-MAX_HISTORY_TURNS);

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SUPPORT_SYSTEM_PROMPT },
    ...trimmedForModel.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolEvents: ToolEvent[] = [];
  let assistantContent = "";

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

  const toolCalls = choice.message.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const toolResults: OpenAI.ChatCompletionMessageParam[] = [
      choice.message as OpenAI.ChatCompletionMessageParam,
    ];

    for (const toolCall of toolCalls) {
      const result = await handleToolCall(
        toolCall,
        userId,
        userEmail,
        resolvedPageUrl,
        conversation.id,
        toolEvents,
      );
      if (result) toolResults.push(result);
    }

    const followUp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...openaiMessages, ...toolResults],
      tools: SUPPORT_TOOLS,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const followUpChoice = followUp.choices[0];
    const followUpToolCalls = followUpChoice?.message?.tool_calls;

    if (followUpToolCalls && followUpToolCalls.length > 0) {
      const secondToolResults: OpenAI.ChatCompletionMessageParam[] = [
        followUpChoice.message as OpenAI.ChatCompletionMessageParam,
      ];

      for (const toolCall of followUpToolCalls) {
        const result = await handleToolCall(
          toolCall,
          userId,
          userEmail,
          resolvedPageUrl,
          conversation.id,
          toolEvents,
        );
        if (result) secondToolResults.push(result);
      }

      const thirdResponse = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...openaiMessages, ...toolResults, ...secondToolResults],
        temperature: 0.7,
        max_tokens: 1000,
      });

      assistantContent =
        thirdResponse.choices[0]?.message?.content ?? "Lo siento, ocurrió un error.";
    } else {
      assistantContent = followUpChoice?.message?.content ?? "Lo siento, ocurrió un error.";
    }
  } else {
    assistantContent = choice.message.content ?? "Lo siento, ocurrió un error.";
  }

  const events = toEvents(toolEvents);
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: assistantContent,
    ...(events.length > 0 ? { events } : {}),
  };

  const updatedMessages = [...historyWithUser, assistantMessage];

  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      messages: JSON.parse(JSON.stringify(updatedMessages)),
      lastMessageAt: new Date(),
      ...(resolvedPageUrl ? { pageUrl: resolvedPageUrl } : {}),
    },
  });

  if (shouldGenerateTitle(updatedMessages.length, conversation.title)) {
    generateConversationTitle(conversation.id, updatedMessages, getOpenAI()).catch((err) =>
      console.error("Failed to generate conversation title:", err),
    );
  }

  return Response.json({
    conversationId: conversation.id,
    content: assistantContent,
    events,
  });
}
