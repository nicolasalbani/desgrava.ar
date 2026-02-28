import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateIngestToken, getIngestEmail } from "@/lib/email/token";

// GET: Return user's ingest email (lazy-generate token if missing)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ingestToken: true },
  });

  if (!user?.ingestToken) {
    const token = generateIngestToken();
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { ingestToken: token },
      select: { ingestToken: true },
    });
  }

  return NextResponse.json({
    ingestEmail: getIngestEmail(user!.ingestToken!),
  });
}

// POST: Regenerate token (invalidates old ingest email address)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = generateIngestToken();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { ingestToken: token },
  });

  return NextResponse.json({
    ingestEmail: getIngestEmail(token),
  });
}
