import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const firstName = session.user.name?.split(" ")[0] ?? "usuario";

  return (
    <DashboardShell
      onboardingCompleted={session.user.onboardingCompleted}
      tourSeen={session.user.tourSeen}
      firstName={firstName}
    >
      {children}
    </DashboardShell>
  );
}
