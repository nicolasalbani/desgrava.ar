import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto/encryption";
import { saveCredentialsSchema } from "@/lib/validators/credentials";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = saveCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { cuit, clave } = parsed.data;
    const { encrypted, iv, authTag } = encrypt(clave);

    const credential = await prisma.arcaCredential.upsert({
      where: { userId: session.user.id },
      update: {
        cuit,
        encryptedClave: encrypted,
        iv,
        authTag,
        isValidated: false,
      },
      create: {
        userId: session.user.id,
        cuit,
        encryptedClave: encrypted,
        iv,
        authTag,
      },
    });

    return NextResponse.json({
      id: credential.id,
      cuit: credential.cuit,
      isValidated: credential.isValidated,
      updatedAt: credential.updatedAt,
    });
  } catch (error) {
    console.error("Error saving credentials:", error);
    return NextResponse.json(
      { error: "Error al guardar credenciales" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const credential = await prisma.arcaCredential.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      cuit: true,
      isValidated: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ credential });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await prisma.arcaCredential.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
