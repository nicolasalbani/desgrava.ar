import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    preference: preference ?? {
      defaultFiscalYear: null,
      notifications: true,
      ownsProperty: false,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { defaultFiscalYear, notifications, ownsProperty } = body;

  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    update: { defaultFiscalYear, notifications, ownsProperty },
    create: {
      userId: session.user.id,
      defaultFiscalYear: defaultFiscalYear ?? null,
      notifications: notifications ?? true,
      ownsProperty: ownsProperty ?? false,
    },
  });

  return NextResponse.json({ preference });
}
