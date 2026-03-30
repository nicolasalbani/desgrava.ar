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

  const dependents = await prisma.familyDependent.findMany({
    where: { userId: session.user.id, fiscalYear: year },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ dependents });
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

  const dependent = await prisma.familyDependent.create({
    data: {
      userId: session.user.id,
      fiscalYear: body.fiscalYear,
      tipoDoc: body.tipoDoc,
      numeroDoc: body.numeroDoc,
      apellido: body.apellido,
      nombre: body.nombre,
      fechaNacimiento: body.fechaNacimiento || null,
      parentesco: body.parentesco,
      fechaUnion: body.fechaUnion || null,
      porcentajeDed: body.porcentajeDed || null,
      cuitOtroDed: body.cuitOtroDed || null,
      familiaCargo: body.familiaCargo ?? true,
      residente: body.residente ?? true,
      tieneIngresos: body.tieneIngresos ?? false,
      montoIngresos: body.montoIngresos ? body.montoIngresos : null,
      mesDesde: body.mesDesde ?? 1,
      mesHasta: body.mesHasta ?? 12,
      proximosPeriodos: body.proximosPeriodos ?? true,
    },
  });

  return NextResponse.json({ dependent }, { status: 201 });
}
