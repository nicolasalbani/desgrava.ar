import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.familyDependent.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const dependent = await prisma.familyDependent.update({
    where: { id },
    data: {
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

  return NextResponse.json({ dependent });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.familyDependent.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.familyDependent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
