import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? "", 10);
  if (!year) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const personalData = await prisma.personalData.findUnique({
    where: { userId_fiscalYear: { userId: session.user.id, fiscalYear: year } },
  });

  return NextResponse.json({ personalData });
}
