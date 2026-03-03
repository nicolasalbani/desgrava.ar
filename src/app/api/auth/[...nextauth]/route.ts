import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const cookieStore = await cookies();
  const inviteToken = cookieStore.get("invite_token")?.value;
  return NextAuth(getAuthOptions(inviteToken))(req, { params: await context.params });
}

export async function POST(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const cookieStore = await cookies();
  const inviteToken = cookieStore.get("invite_token")?.value;
  return NextAuth(getAuthOptions(inviteToken))(req, { params: await context.params });
}
