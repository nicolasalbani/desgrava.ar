import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const logs = await prisma.emailIngestLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fromAddress: true,
      subject: true,
      status: true,
      attachmentCount: true,
      invoicesCreated: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
