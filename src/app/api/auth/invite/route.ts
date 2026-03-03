import { NextRequest, NextResponse } from "next/server";
import { INVITE_CODES, createInviteToken } from "@/lib/invite-codes";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code || !INVITE_CODES.includes(code.trim().toUpperCase())) {
    return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
  }

  const token = createInviteToken(code.trim().toUpperCase());

  const res = NextResponse.json({ ok: true });
  res.cookies.set("invite_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });
  return res;
}
