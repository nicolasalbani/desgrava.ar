import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuario";

  const [credentialCount, userPreference] = await Promise.all([
    prisma.arcaCredential.count({ where: { userId } }),
    prisma.userPreference.findUnique({ where: { userId }, select: { defaultFiscalYear: true } }),
  ]);

  const activeYear = userPreference?.defaultFiscalYear ?? new Date().getFullYear();

  const [invoiceCount, completedJobCount, yearPref] = await Promise.all([
    prisma.invoice.count({ where: { userId, fiscalYear: activeYear } }),
    prisma.automationJob.count({ where: { userId, status: "COMPLETED" } }),
    prisma.userYearPreference.findUnique({
      where: { userId_fiscalYear: { userId, fiscalYear: activeYear } },
      select: { id: true },
    }),
  ]);

  const completedSteps: [boolean, boolean, boolean, boolean, boolean] = [
    credentialCount > 0,
    userPreference?.defaultFiscalYear != null,
    yearPref != null,
    invoiceCount > 0,
    completedJobCount > 0,
  ];

  return (
    <div className="space-y-8">
      <OnboardingTour completedSteps={completedSteps} firstName={firstName} />
    </div>
  );
}
