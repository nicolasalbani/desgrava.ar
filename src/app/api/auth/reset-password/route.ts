import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators/password";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = rateLimit(`reset:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo en un minuto." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !record.identifier.startsWith("reset:") || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    }
    return NextResponse.json(
      { error: "El enlace expiró o es inválido. Solicita uno nuevo." },
      { status: 400 },
    );
  }

  const email = record.identifier.replace("reset:", "");
  const passwordHash = await bcrypt.hash(password, 12);

  // Update password and also verify email (reset proves email ownership)
  await prisma.user.update({
    where: { email },
    data: { passwordHash, emailVerified: new Date() },
  });

  // Delete the token (single-use)
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ message: "Contraseña actualizada correctamente." });
}
