import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!year) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const pref = await prisma.userYearPreference.upsert({
    where: { userId_fiscalYear: { userId: session.user.id, fiscalYear: year } },
    update: {},
    create: { userId: session.user.id, fiscalYear: year, ownsProperty: false },
  });

  return NextResponse.json({ ownsProperty: pref.ownsProperty });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { year, ownsProperty } = await req.json();
  if (!year) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const pref = await prisma.userYearPreference.upsert({
    where: { userId_fiscalYear: { userId: session.user.id, fiscalYear: year } },
    update: { ownsProperty },
    create: { userId: session.user.id, fiscalYear: year, ownsProperty },
  });

  return NextResponse.json({ ownsProperty: pref.ownsProperty });
}
