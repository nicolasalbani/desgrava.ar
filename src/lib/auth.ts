import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { validateInviteToken } from "@/lib/invite-codes";

export function getAuthOptions(inviteToken?: string): NextAuthOptions {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async signIn({ user }) {
        // Existing users can always sign in
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true },
        });
        if (existing) return true;

        // New user — require a valid invite token
        if (!inviteToken || !validateInviteToken(inviteToken)) {
          return "/login?error=invite_required";
        }

        return true;
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
        }
        return token;
      },
    },
    pages: {
      signIn: "/login",
    },
  };
}

// Convenience export for places that don't need per-request invite token
export const authOptions: NextAuthOptions = getAuthOptions();
