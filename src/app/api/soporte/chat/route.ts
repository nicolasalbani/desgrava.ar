import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewTicketEmail } from "@/lib/email";
import OpenAI from "openai";
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_TOOLS, JOB_TYPE_LABELS } from "@/lib/soporte/system-prompt";

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

/** Validate that an automation job ID exists and belongs to the user. Returns the ID if valid, null otherwise. */
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
  messages: IncomingMessage[],
  events: ToolEvent[],
  existingTicketId: string | undefined,
): Promise<OpenAI.ChatCompletionToolMessageParam | null> {
  if (toolCall.type !== "function") return null;
  const args = JSON.parse(toolCall.function.arguments);

  if (toolCall.function.name === "create_ticket") {
    const automationJobId = await resolveAutomationJobId(args.automation_job_id, userId);

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: args.subject,
        description: args.description,
        pageUrl,
        conversationLog: JSON.parse(JSON.stringify(messages)),
        automationJobId,
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

  const userId = session.user.id;
  const userEmail = session.user.email ?? "unknown";
  const resolvedPageUrl = pageUrl || null;

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
    const events: ToolEvent[] = [];
    const toolResults: OpenAI.ChatCompletionMessageParam[] = [
      choice.message as OpenAI.ChatCompletionMessageParam,
    ];

    for (const toolCall of toolCalls) {
      const result = await handleToolCall(
        toolCall,
        userId,
        userEmail,
        resolvedPageUrl,
        messages,
        events,
        existingTicketId,
      );
      if (result) toolResults.push(result);
    }

    // Second call — get the AI's response after tool execution
    const followUp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...openaiMessages, ...toolResults],
      tools: SUPPORT_TOOLS,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Handle second-round tool calls (e.g. create_ticket after lookup)
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
          messages,
          events,
          existingTicketId,
        );
        if (result) secondToolResults.push(result);
      }

      // Third call — final response after second-round tools
      const thirdResponse = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...openaiMessages, ...toolResults, ...secondToolResults],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return Response.json({
        content: thirdResponse.choices[0]?.message?.content ?? "Lo siento, ocurrió un error.",
        events,
      });
    }

    const followUpContent = followUpChoice?.message?.content ?? "Lo siento, ocurrió un error.";

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
