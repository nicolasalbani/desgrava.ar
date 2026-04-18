import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL ?? req.url;
}

// GET exists only for backward compatibility with verification emails sent
// before the two-step flow. Email link scanners (e.g. Outlook/Hotmail SafeLinks)
// pre-fetch links, which would consume the single-use token if GET did the
// verification. Redirect to the interstitial page, which requires a user POST.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const url = new URL("/verify-email", getBaseUrl(req));
  if (token) url.searchParams.set("token", token);
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  let token: string | null = null;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : null;
  } catch {
    token = null;
  }

  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !record.identifier.startsWith("verify:") || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    }
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  const email = record.identifier.replace("verify:", "");

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ ok: true });
}
