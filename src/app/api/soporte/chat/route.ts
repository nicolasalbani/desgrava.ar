import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupportIssue } from "@/lib/github/issues";
import type { AutomationJobSnapshot } from "@/lib/github/issues";
import { sendNewGithubIssueNotification } from "@/lib/telegram";
import OpenAI from "openai";
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_TOOLS, JOB_TYPE_LABELS } from "@/lib/soporte/system-prompt";
import { generateConversationTitle, shouldGenerateTitle } from "@/lib/soporte/conversation-title";
import { groupFailedJobs } from "@/lib/soporte/group-failed-jobs";
import { claimsTicketCreationWithoutInvocation } from "@/lib/soporte/ticket-hallucination";
import { looksLikeAutomationReport } from "@/lib/soporte/looks-like-automation-report";
import type { ChatMessage, SupportEvent } from "@/lib/soporte/types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const MAX_HISTORY_TURNS = 40;
const FAILED_JOBS_PREFETCH_LIMIT = 50;

async function resolveAutomationJobSnapshot(
  jobId: string | undefined | null,
  userId: string,
): Promise<AutomationJobSnapshot | null> {
  if (!jobId) return null;
  const job = await prisma.automationJob.findFirst({
    where: { id: jobId, userId },
    include: {
      invoice: {
        select: {
          id: true,
          providerCuit: true,
          providerName: true,
          invoiceType: true,
          invoiceNumber: true,
          invoiceDate: true,
          amount: true,
          fiscalYear: true,
          fiscalMonth: true,
          deductionCategory: true,
          source: true,
          siradiqStatus: true,
        },
      },
      presentacion: {
        select: { id: true, descripcion: true, fiscalYear: true, siradiqStatus: true },
      },
      employer: {
        select: { id: true, razonSocial: true, cuit: true },
      },
      familyDependent: {
        select: { id: true, nombre: true, apellido: true, parentesco: true },
      },
      domesticReceipts: {
        select: {
          id: true,
          periodo: true,
          domesticWorker: { select: { id: true, apellidoNombre: true } },
        },
      },
    },
  });

  if (!job) return null;

  let relatedEntity: AutomationJobSnapshot["relatedEntity"] = null;
  if (job.invoice) {
    const inv = job.invoice;
    relatedEntity = {
      kind: "invoice",
      id: inv.id,
      label: inv.providerName ?? inv.providerCuit,
      details: {
        providerCuit: inv.providerCuit,
        invoiceType: inv.invoiceType,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate ? inv.invoiceDate.toISOString().slice(0, 10) : null,
        amount: inv.amount.toString(),
        fiscalYear: inv.fiscalYear,
        fiscalMonth: inv.fiscalMonth,
        deductionCategory: inv.deductionCategory,
        source: inv.source,
        siradiqStatus: inv.siradiqStatus,
      },
    };
  } else if (job.presentacion) {
    relatedEntity = {
      kind: "presentacion",
      id: job.presentacion.id,
      label: job.presentacion.descripcion,
      details: {
        fiscalYear: job.presentacion.fiscalYear,
        siradiqStatus: job.presentacion.siradiqStatus,
      },
    };
  } else if (job.employer) {
    relatedEntity = {
      kind: "employer",
      id: job.employer.id,
      label: job.employer.razonSocial,
      details: { cuit: job.employer.cuit },
    };
  } else if (job.familyDependent) {
    relatedEntity = {
      kind: "familyDependent",
      id: job.familyDependent.id,
      label: `${job.familyDependent.nombre} ${job.familyDependent.apellido}`.trim(),
      details: { parentesco: job.familyDependent.parentesco },
    };
  } else if (job.domesticReceipts.length > 0) {
    const receipt = job.domesticReceipts[0];
    relatedEntity = {
      kind: "domesticReceipt",
      id: receipt.id,
      label: receipt.domesticWorker
        ? `${receipt.domesticWorker.apellidoNombre} — ${receipt.periodo}`
        : receipt.periodo,
      details: {
        periodo: receipt.periodo,
        domesticWorkerId: receipt.domesticWorker?.id ?? null,
        receiptCount: job.domesticReceipts.length,
      },
    };
  }

  return {
    id: job.id,
    jobType: job.jobType,
    jobTypeLabel: JOB_TYPE_LABELS[job.jobType] || job.jobType,
    status: job.status,
    errorMessage: job.errorMessage,
    currentStep: job.currentStep,
    fiscalYear: job.fiscalYear,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    relatedEntity,
  };
}

function resolveEnvironment(): string {
  if (process.env.VERCEL_ENV) return `vercel:${process.env.VERCEL_ENV}`;
  if (process.env.NODE_ENV === "production") return "production";
  return process.env.NODE_ENV || "development";
}

interface ToolEvent {
  type: string;
  issueNumber?: number;
  issueUrl?: string;
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
    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { messages: true, githubIssueNumber: true, githubIssueUrl: true },
    });
    if (conversation?.githubIssueNumber) {
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          success: false,
          message:
            "Ya existe un ticket para esta conversación. Iniciá una nueva conversación si querés reportar otro problema.",
          existingTicketId: `#${conversation.githubIssueNumber}`,
        }),
      };
    }

    const automationJob = await resolveAutomationJobSnapshot(args.automation_job_id, userId);
    const messagesForLog = (conversation?.messages as unknown as ChatMessage[]) ?? [];

    if (!automationJob && looksLikeAutomationReport(messagesForLog, args.description)) {
      console.warn(
        "create_ticket called without automation_job_id but conversation looks like an automation report",
        { conversationId, userId, subject: args.subject },
      );
    }

    let issue: { number: number; url: string };
    try {
      issue = await createSupportIssue({
        subject: args.subject,
        description: args.description,
        userId,
        userEmail,
        conversationId,
        pageUrl,
        submittedAt: new Date().toISOString(),
        environment: resolveEnvironment(),
        automationJob,
        conversationLog: messagesForLog,
      });
    } catch (err) {
      console.error("Failed to create GitHub issue:", err);
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          success: false,
          message:
            "No pude crear el ticket en este momento. Probá de nuevo en unos minutos o escribinos por WhatsApp.",
        }),
      };
    }

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.url,
      },
    });

    sendNewGithubIssueNotification({
      issueNumber: issue.number,
      issueUrl: issue.url,
      subject: args.subject,
      description: args.description,
      userEmail,
      pageUrl,
      automationJobId: automationJob?.id ?? null,
    }).catch((err) => console.error("Failed to send Telegram notification:", err));

    events.push({
      type: "ticket_created",
      issueNumber: issue.number,
      issueUrl: issue.url,
      subject: args.subject,
    });

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: true,
        ticketId: `#${issue.number}`,
        message: `Ticket creado con ID #${issue.number}`,
      }),
    };
  }

  if (toolCall.function.name === "offer_whatsapp") {
    const whatsappNumber = process.env.SUPPORT_WHATSAPP || "";
    const ticketEvent = events.find((e) => e.type === "ticket_created");
    let resolvedTicketRef: string | undefined = ticketEvent?.issueNumber
      ? `#${ticketEvent.issueNumber}`
      : undefined;
    if (!resolvedTicketRef) {
      const existing = await prisma.supportConversation.findUnique({
        where: { id: conversationId },
        select: { githubIssueNumber: true },
      });
      if (existing?.githubIssueNumber) {
        resolvedTicketRef = `#${existing.githubIssueNumber}`;
      }
    }
    let whatsappText = `Hola, necesito ayuda con desgrava.ar.\n\n${args.summary}`;
    if (resolvedTicketRef) {
      whatsappText += `\n\nTicket: ${resolvedTicketRef}`;
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
      take: FAILED_JOBS_PREFETCH_LIMIT,
      include: {
        invoice: { select: { providerName: true, providerCuit: true } },
        domesticReceipts: {
          select: {
            id: true,
            periodo: true,
            domesticWorker: { select: { id: true, apellidoNombre: true } },
          },
        },
        presentacion: { select: { descripcion: true } },
        employer: { select: { razonSocial: true } },
      },
    });

    const problems = groupFailedJobs(failedJobs, { jobTypeLabels: JOB_TYPE_LABELS });

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: true,
        count: problems.length,
        totalAttempts: failedJobs.length,
        problems,
      }),
    };
  }

  return null;
}

/**
 * gpt-4o-mini sometimes narrates "ticket creado" without actually invoking create_ticket.
 * When that happens we re-call the model with tool_choice forced so the tool runs for real.
 * Returns the new user-facing content (or the original content if the corrective didn't
 * succeed in forcing a tool call).
 */
async function forceCreateTicketIfHallucinated(params: {
  assistantContent: string;
  toolEvents: ToolEvent[];
  conversationId: string;
  userId: string;
  userEmail: string;
  pageUrl: string | null;
  openaiMessages: OpenAI.ChatCompletionMessageParam[];
}): Promise<string> {
  const {
    assistantContent,
    toolEvents,
    conversationId,
    userId,
    userEmail,
    pageUrl,
    openaiMessages,
  } = params;

  const existing = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    select: { githubIssueNumber: true },
  });

  const shouldCorrect = claimsTicketCreationWithoutInvocation(assistantContent, {
    ticketEventEmitted: toolEvents.some((e) => e.type === "ticket_created"),
    conversationAlreadyHasTicket: existing?.githubIssueNumber !== null,
  });

  if (!shouldCorrect) return assistantContent;

  console.warn("Detected ticket-creation hallucination; forcing create_ticket tool call", {
    conversationId,
    snippet: assistantContent.slice(0, 120),
  });

  const corrective = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      ...openaiMessages,
      { role: "assistant", content: assistantContent },
      {
        role: "system",
        content:
          "Tu respuesta anterior afirmó que el ticket fue creado, pero NO invocaste la herramienta create_ticket. Llamala AHORA con subject y description basados en el problema que el usuario acaba de confirmar. No respondas con texto — el contenido del mensaje debe quedar vacío y solo tiene que haber una tool_call a create_ticket.",
      },
    ],
    tools: SUPPORT_TOOLS,
    tool_choice: { type: "function", function: { name: "create_ticket" } },
    temperature: 0.2,
    max_tokens: 500,
  });

  const correctiveChoice = corrective.choices[0];
  const correctiveToolCalls = correctiveChoice?.message?.tool_calls;
  if (!correctiveToolCalls || correctiveToolCalls.length === 0) {
    return "Quise crear el ticket pero hubo un problema. ¿Podés intentarlo de nuevo o escribirnos por WhatsApp?";
  }

  const toolResults: OpenAI.ChatCompletionMessageParam[] = [
    correctiveChoice.message as OpenAI.ChatCompletionMessageParam,
  ];
  for (const tc of correctiveToolCalls) {
    const result = await handleToolCall(tc, userId, userEmail, pageUrl, conversationId, toolEvents);
    if (result) toolResults.push(result);
  }

  const synth = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...openaiMessages, ...toolResults],
    temperature: 0.7,
    max_tokens: 500,
  });

  return synth.choices[0]?.message?.content ?? assistantContent;
}

function toEvents(toolEvents: ToolEvent[]): SupportEvent[] {
  const events: SupportEvent[] = [];
  for (const e of toolEvents) {
    if (
      e.type === "ticket_created" &&
      typeof e.issueNumber === "number" &&
      e.issueUrl &&
      e.subject
    ) {
      events.push({
        type: "ticket_created",
        issueNumber: e.issueNumber,
        issueUrl: e.issueUrl,
        subject: e.subject,
      });
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

  assistantContent = await forceCreateTicketIfHallucinated({
    assistantContent,
    toolEvents,
    conversationId: conversation.id,
    userId,
    userEmail,
    pageUrl: resolvedPageUrl,
    openaiMessages,
  });

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
