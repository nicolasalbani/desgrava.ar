import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateInviteToken } from "@/lib/invite-codes";
import { createTrialSubscription } from "@/lib/subscription/create";

export function getAuthOptions(inviteToken?: string): NextAuthOptions {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.passwordHash) return null;
          if (!user.emailVerified) return null;

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) return null;

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
      }),
    ],
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async signIn({ user, account }) {
        // Credentials provider handles its own validation
        if (account?.provider === "credentials") return true;

        // Google sign-in: check existing user
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, accounts: { where: { provider: "google" } } },
        });

        if (existing) {
          // Auto-link Google account if user exists but has no Google account linked
          if (existing.accounts.length === 0 && account?.provider === "google") {
            await prisma.account.create({
              data: {
                userId: existing.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            });
            // Also mark email as verified since Google verified it
            await prisma.user.update({
              where: { id: existing.id },
              data: { emailVerified: new Date() },
            });
            // Override user.id so JWT uses the existing user
            user.id = existing.id;
          }
          return true;
        }

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
      async jwt({ token, user, trigger }) {
        if (user) {
          token.sub = user.id;
        }
        // Create trial subscription for newly signed-up users
        if (trigger === "signUp" && token.sub) {
          await createTrialSubscription(token.sub);
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
