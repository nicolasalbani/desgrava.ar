import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = rateLimit(`forgot:${ip}`, { limit: 3, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo en un minuto." },
      { status: 429 },
    );
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  // Always return success to avoid leaking whether email exists
  const successResponse = NextResponse.json({
    message: "Si el email existe, recibirás un enlace para restablecer tu contraseña.",
  });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return successResponse;

  // Delete any existing reset tokens for this email
  await prisma.verificationToken
    .deleteMany({
      where: { identifier: `reset:${email}` },
    })
    .catch(() => {});

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: `reset:${email}`,
      token,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // Send email in background — always return success
  sendPasswordResetEmail(email, token).catch((err) => {
    console.error("Failed to send password reset email:", err);
  });

  return successResponse;
}
