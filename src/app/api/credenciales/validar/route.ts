import { NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/subscription/require-write-access";
import { processJob } from "@/lib/automation/job-processor";
import { isFiscalYearReadOnly } from "@/lib/fiscal-year";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const denied = await requireWriteAccess(session.user.id);
  if (denied) return denied;

  const credential = await prisma.arcaCredential.findUnique({
    where: { userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.json({ error: "No hay credenciales guardadas" }, { status: 404 });
  }

  await prisma.arcaCredential.update({
    where: { userId: session.user.id },
    data: { isValidated: true },
  });

  // Auto-trigger PULL_PROFILE to import all profile data after credential validation
  const fiscalYear = new Date().getFullYear();
  let pullProfileJobId: string | null = null;

  if (!isFiscalYearReadOnly(fiscalYear)) {
    // Only create if there's no active PULL_PROFILE job already
    const activeJob = await prisma.automationJob.findFirst({
      where: {
        userId: session.user.id,
        jobType: "PULL_PROFILE",
        status: { in: ["PENDING", "RUNNING"] },
      },
    });

    if (!activeJob) {
      const pullJob = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType: "PULL_PROFILE",
          fiscalYear,
          status: "PENDING",
        },
      });
      pullProfileJobId = pullJob.id;

      after(async () => {
        try {
          await processJob(pullJob.id);
        } catch (err) {
          console.error("PULL_PROFILE auto-trigger error:", err);
        }
      });
    }
  }

  return NextResponse.json({
    valid: true,
    message:
      "Credenciales guardadas correctamente. La validacion con ARCA se realizara al automatizar.",
    pullProfileJobId,
  });
}
