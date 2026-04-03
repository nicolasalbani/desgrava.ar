import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketResolvedEmail } from "@/lib/email";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Allow admin access via CRON_SECRET header (same secret used for cron endpoints)
  const authHeader = req.headers.get("authorization");
  const isAdmin = authHeader === `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET;

  if (!isAdmin) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const { id } = await params;
  const body = await req.json();
  const { status, resolution } = body;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(resolution && { resolution }),
    },
  });

  // Send email to user when ticket is resolved
  if (status === "RESOLVED" && resolution && ticket.user.email) {
    sendTicketResolvedEmail(ticket.user.email, ticket.subject, resolution).catch((err) =>
      console.error("Failed to send resolution email:", err),
    );
  }

  return NextResponse.json(updated);
}
