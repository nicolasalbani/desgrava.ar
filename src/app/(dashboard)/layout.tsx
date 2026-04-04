import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Verify the user record actually exists in the DB (session cookie may outlive a DB reset)
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { id: true, onboardingCompleted: true },
  });

  if (!user) {
    redirect("/api/auth/signout");
  }

  return <DashboardShell onboardingCompleted={user.onboardingCompleted}>{children}</DashboardShell>;
}
