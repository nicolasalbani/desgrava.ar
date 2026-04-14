import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTrialSubscription } from "@/lib/subscription/create";
import { sendNewUserNotification } from "@/lib/telegram";

export function getAuthOptions(): NextAuthOptions {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: true,
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

        // Google sign-in: mark email as verified since Google verified it
        if (account?.provider === "google" && user.email) {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, emailVerified: true },
          });

          if (existing && !existing.emailVerified) {
            await prisma.user.update({
              where: { id: existing.id },
              data: { emailVerified: new Date() },
            });
          }
        }

        return true;
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
          // Refresh name and image from DB so profile changes are visible immediately
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { name: true, image: true },
          });
          if (dbUser?.name) {
            session.user.name = dbUser.name;
          }
          if (dbUser?.image) {
            session.user.image = dbUser.image;
          }
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
          const email = user?.email ?? token.email;
          if (email) {
            sendNewUserNotification(email, "Google").catch((err) => {
              console.error("Failed to send Telegram notification:", err);
            });
          }
        }
        return token;
      },
    },
    pages: {
      signIn: "/login",
    },
  };
}

export const authOptions: NextAuthOptions = getAuthOptions();
