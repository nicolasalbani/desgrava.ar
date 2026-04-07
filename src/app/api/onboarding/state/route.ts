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

  const [
    credential,
    pullProfileJob,
    activePullProfileJob,
    activePullComprobantesJob,
    activeSubmitInvoiceJob,
    invoiceCount,
    completedSubmitJob,
    employerCount,
  ] = await Promise.all([
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
    prisma.automationJob.findFirst({
      where: {
        userId,
        jobType: "PULL_COMPROBANTES",
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { id: true, currentStep: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.automationJob.findFirst({
      where: {
        userId,
        jobType: "SUBMIT_INVOICE",
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
    prisma.employer.count({
      where: { userId, fiscalYear },
    }),
  ]);

  // Derive the step the user should be on.
  // This endpoint is only called during onboarding (onboardingCompleted === false),
  // so step 4 is always shown when invoices exist — never skip to 5.
  let step: number;
  if (!credential) {
    step = 1;
  } else if (activePullProfileJob || (!pullProfileJob && !activePullProfileJob)) {
    step = 2;
  } else if (activePullComprobantesJob || invoiceCount === 0) {
    step = 3;
  } else {
    step = 4;
  }

  return NextResponse.json({
    step,
    hasCredentials: !!credential,
    credentialsValidated: credential?.isValidated ?? false,
    activePullProfileJobId: activePullProfileJob?.id ?? null,
    activePullProfileStep: activePullProfileJob?.currentStep ?? null,
    profilePullCompleted: !!pullProfileJob,
    activePullComprobantesJobId: activePullComprobantesJob?.id ?? null,
    activeSubmitInvoiceJobId: activeSubmitInvoiceJob?.id ?? null,
    deducibleInvoiceCount: invoiceCount,
    hasCompletedSubmission: !!completedSubmitJob,
    hasEmployers: employerCount > 0,
  });
}
