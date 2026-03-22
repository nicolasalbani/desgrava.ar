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
      autoSubmitEnabled: false,
      autoSubmitDay: null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { defaultFiscalYear, notifications, autoSubmitEnabled, autoSubmitDay } = body;

  // Validate autoSubmitDay range
  if (autoSubmitDay !== undefined && autoSubmitDay !== null) {
    const day = parseInt(autoSubmitDay);
    if (isNaN(day) || day < 1 || day > 28) {
      return NextResponse.json({ error: "El día debe estar entre 1 y 28" }, { status: 400 });
    }
  }

  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    update: {
      defaultFiscalYear,
      notifications,
      ...(autoSubmitEnabled !== undefined && { autoSubmitEnabled }),
      ...(autoSubmitDay !== undefined && {
        autoSubmitDay: autoSubmitDay === null ? null : parseInt(autoSubmitDay),
      }),
    },
    create: {
      userId: session.user.id,
      defaultFiscalYear: defaultFiscalYear ?? null,
      notifications: notifications ?? true,
      autoSubmitEnabled: autoSubmitEnabled ?? false,
      autoSubmitDay: autoSubmitDay ? parseInt(autoSubmitDay) : null,
    },
  });

  return NextResponse.json({ preference });
}
