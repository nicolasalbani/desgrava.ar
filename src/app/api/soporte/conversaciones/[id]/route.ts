import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/soporte/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.supportConversation.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      messages: true,
      createdAt: true,
      lastMessageAt: true,
      ticket: { select: { id: true } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    messages: (conversation.messages as unknown as ChatMessage[]) ?? [],
    createdAt: conversation.createdAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    hasTicket: conversation.ticket !== null,
  });
}
