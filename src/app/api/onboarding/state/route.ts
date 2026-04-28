import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const fiscalYear = new Date().getFullYear();

  const [credential, pullProfileJob, activePullProfileJob, employerCount, activePushEmployersJob] =
    await Promise.all([
      prisma.arcaCredential.findUnique({
        where: { userId },
        select: { isValidated: true },
      }),
      prisma.automationJob.findFirst({
        where: { userId, jobType: "PULL_PROFILE", status: "COMPLETED" },
        select: { id: true },
      }),
      prisma.automationJob.findFirst({
        where: {
          userId,
          jobType: "PULL_PROFILE",
          status: { in: ["PENDING", "RUNNING"] },
        },
        select: { id: true, currentStep: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employer.count({
        where: { userId, fiscalYear, agenteRetencion: true },
      }),
      prisma.automationJob.findFirst({
        where: {
          userId,
          jobType: "PUSH_EMPLOYERS",
          status: { in: ["PENDING", "RUNNING"] },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // Derive the step the user should be on. Onboarding is now 2 steps:
  //   1. Credenciales ARCA, 2. Perfil impositivo.
  let step: number;
  if (!credential) {
    step = 1;
  } else {
    step = 2;
  }

  return NextResponse.json({
    step,
    hasCredentials: !!credential,
    credentialsValidated: credential?.isValidated ?? false,
    activePullProfileJobId: activePullProfileJob?.id ?? null,
    activePullProfileStep: activePullProfileJob?.currentStep ?? null,
    profilePullCompleted: !!pullProfileJob,
    hasEmployers: employerCount > 0,
    activePushEmployersJobId: activePushEmployersJob?.id ?? null,
  });
}
