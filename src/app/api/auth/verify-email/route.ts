import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !record.identifier.startsWith("verify:") || record.expires < new Date()) {
    // Clean up expired token if it exists
    if (record) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    }
    return NextResponse.redirect(new URL("/login?error=token_expired", req.url));
  }

  const email = record.identifier.replace("verify:", "");

  // Mark user as verified
  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Delete the token (single-use)
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.redirect(new URL("/login?verified=true", req.url));
}
