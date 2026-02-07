import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const credential = await prisma.arcaCredential.findUnique({
    where: { userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.json(
      { error: "No hay credenciales guardadas" },
      { status: 404 }
    );
  }

  await prisma.arcaCredential.update({
    where: { userId: session.user.id },
    data: { isValidated: true },
  });

  return NextResponse.json({
    valid: true,
    message: "Credenciales guardadas correctamente. La validacion con ARCA se realizara al automatizar.",
  });
}
