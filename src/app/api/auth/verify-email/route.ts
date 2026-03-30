import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL ?? req.url;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", getBaseUrl(req)));
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !record.identifier.startsWith("verify:") || record.expires < new Date()) {
    // Clean up expired token if it exists
    if (record) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    }
    return NextResponse.redirect(new URL("/login?error=token_expired", getBaseUrl(req)));
  }

  const email = record.identifier.replace("verify:", "");

  // Mark user as verified
  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Delete the token (single-use)
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.redirect(new URL("/login?verified=true", getBaseUrl(req)));
}
