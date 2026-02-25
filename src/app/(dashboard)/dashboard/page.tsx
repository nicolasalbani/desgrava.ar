import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuario";

  const [credentialCount, invoiceCount, completedJobCount] = await Promise.all([
    prisma.arcaCredential.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.automationJob.count({ where: { userId, status: "COMPLETED" } }),
  ]);

  const completedSteps: [boolean, boolean, boolean] = [
    credentialCount > 0,
    invoiceCount > 0,
    completedJobCount > 0,
  ];

  return (
    <div className="space-y-8">
      <OnboardingTour completedSteps={completedSteps} firstName={firstName} />
    </div>
  );
}
