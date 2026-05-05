import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ChatMessage, ConversationSummary } from "@/lib/soporte/types";

const PREVIEW_MAX_LENGTH = 100;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const conversations = await prisma.supportConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      title: true,
      messages: true,
      createdAt: true,
      lastMessageAt: true,
      ticket: { select: { id: true } },
    },
  });

  const summaries: ConversationSummary[] = conversations.map((c) => {
    const messages = (c.messages as unknown as ChatMessage[]) ?? [];
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const preview = lastAssistant ? lastAssistant.content.slice(0, PREVIEW_MAX_LENGTH) : null;
    return {
      id: c.id,
      title: c.title,
      preview,
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      hasTicket: c.ticket !== null,
    };
  });

  return NextResponse.json(summaries);
}
