import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/subscription/require-write-access";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!year) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const employers = await prisma.employer.findMany({
    where: { userId: session.user.id, fiscalYear: year },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ employers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const denied = await requireWriteAccess(session.user.id);
  if (denied) return denied;

  const body = await req.json();
  if (!body.fiscalYear) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const employer = await prisma.employer.create({
    data: {
      userId: session.user.id,
      fiscalYear: body.fiscalYear,
      cuit: body.cuit,
      razonSocial: body.razonSocial,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin || null,
      agenteRetencion: body.agenteRetencion ?? false,
    },
  });

  return NextResponse.json({ employer }, { status: 201 });
}
