import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/password";
import { INVITE_CODES } from "@/lib/invite-codes";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

async function createAndSendVerificationToken(email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: `verify:${email}`,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });
  // Send email in background — don't fail registration if email fails
  sendVerificationEmail(email, token).catch((err) => {
    console.error("Failed to send verification email:", err);
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { success } = rateLimit(`register:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!success) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo en un minuto." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password, inviteCode } = parsed.data;

    // Validate invite code (raw code, not signed token)
    if (!INVITE_CODES.includes(inviteCode.toUpperCase())) {
      return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Don't reveal whether email exists — but if they have a password, tell them to log in
      if (existing.passwordHash) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con este email. Inicia sesión." },
          { status: 409 },
        );
      }
      // User exists via Google but has no password — set password and send verification
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });

      // If already verified (via Google), they can log in directly
      if (existing.emailVerified) {
        return NextResponse.json({
          message: "Contraseña configurada. Ya puedes iniciar sesión.",
        });
      }

      await createAndSendVerificationToken(email);

      return NextResponse.json({
        message: "Cuenta actualizada. Revisa tu email para verificar tu cuenta.",
        requiresVerification: true,
      });
    }

    // Create new user
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    await createAndSendVerificationToken(email);

    return NextResponse.json({
      message: "Cuenta creada. Revisa tu email para verificar tu cuenta.",
      requiresVerification: true,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
  }
}
