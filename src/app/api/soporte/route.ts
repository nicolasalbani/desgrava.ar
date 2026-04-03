import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewTicketEmail } from "@/lib/email";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      subject: true,
      description: true,
      resolution: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { subject, description, pageUrl, conversationLog } = body;

  if (!subject || !description) {
    return NextResponse.json({ error: "subject and description are required" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      subject,
      description,
      pageUrl: pageUrl || null,
      conversationLog: conversationLog || [],
    },
  });

  // Send notification email to developer (non-blocking)
  sendNewTicketEmail(
    ticket.id,
    subject,
    description,
    session.user.email ?? "unknown",
    pageUrl || null,
  ).catch((err) => console.error("Failed to send ticket notification:", err));

  return NextResponse.json(ticket, { status: 201 });
}
