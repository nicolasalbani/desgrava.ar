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

  const [credential, pullProfileJob, activePullProfileJob, invoiceCount, completedSubmitJob] =
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
      prisma.invoice.count({
        where: {
          userId,
          fiscalYear,
          deductionCategory: { not: "NO_DEDUCIBLE" },
        },
      }),
      prisma.automationJob.findFirst({
        where: { userId, jobType: "SUBMIT_INVOICE", status: "COMPLETED" },
        select: { id: true },
      }),
    ]);

  // Derive the step the user should be on
  let step: number;
  if (!credential) {
    step = 1;
  } else if (!pullProfileJob && !activePullProfileJob) {
    // Has credentials but no profile pull started — show step 2 (will trigger from step 1)
    step = 2;
  } else if (invoiceCount === 0) {
    step = 3;
  } else if (!completedSubmitJob) {
    step = 4;
  } else {
    step = 5; // All done
  }

  return NextResponse.json({
    step,
    hasCredentials: !!credential,
    credentialsValidated: credential?.isValidated ?? false,
    activePullProfileJobId: activePullProfileJob?.id ?? null,
    activePullProfileStep: activePullProfileJob?.currentStep ?? null,
    profilePullCompleted: !!pullProfileJob,
    deducibleInvoiceCount: invoiceCount,
    hasCompletedSubmission: !!completedSubmitJob,
  });
}
