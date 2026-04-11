import { NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/automation/job-processor";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });

  // Queue background jobs to complete the data import silently.
  // These run after the response is sent so the user lands on the dashboard immediately.
  after(async () => {
    try {
      const fiscalYear = new Date().getFullYear();

      // Only queue jobs if user has credentials and employers
      const [credential, employerCount] = await Promise.all([
        prisma.arcaCredential.findUnique({ where: { userId }, select: { id: true } }),
        prisma.employer.count({ where: { userId, fiscalYear } }),
      ]);
      if (!credential || employerCount === 0) return;

      // Helper: create job if no active one exists for this type
      async function createIfNoActive(jobType: string) {
        const active = await prisma.automationJob.findFirst({
          where: {
            userId,
            jobType: jobType as import("@/generated/prisma/enums").JobType,
            status: { in: ["PENDING", "RUNNING"] },
          },
        });
        if (active) return;

        const job = await prisma.automationJob.create({
          data: {
            userId,
            jobType: jobType as import("@/generated/prisma/enums").JobType,
            fiscalYear,
            status: "PENDING",
          },
        });

        try {
          await processJob(job.id);
        } catch (err) {
          console.error(`Post-onboarding ${jobType} error:`, err);
        }
      }

      // 1. Full PULL_COMPROBANTES (with SiRADIG extraction this time)
      await createIfNoActive("PULL_COMPROBANTES");

      // 2. PULL_DOMESTIC_RECEIPTS — only if user has domestic workers
      const workerCount = await prisma.domesticWorker.count({ where: { userId, fiscalYear } });
      if (workerCount > 0) {
        await createIfNoActive("PULL_DOMESTIC_RECEIPTS");
      }

      // 3. PULL_PRESENTACIONES
      await createIfNoActive("PULL_PRESENTACIONES");
    } catch (err) {
      console.error("Post-onboarding background jobs error:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
