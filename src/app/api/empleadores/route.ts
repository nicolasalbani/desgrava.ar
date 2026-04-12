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

  const searchParams = req.nextUrl.searchParams;
  const year = Number(searchParams.get("year"));
  if (!year) {
    return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
  }

  const countOnly = searchParams.get("count") === "true";
  const where = { userId: session.user.id, fiscalYear: year, agenteRetencion: true };

  if (countOnly) {
    const count = await prisma.employer.count({ where });
    return NextResponse.json({ count });
  }

  const employers = await prisma.employer.findMany({
    where,
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
      agenteRetencion: true,
    },
  });

  return NextResponse.json({ employer }, { status: 201 });
}
