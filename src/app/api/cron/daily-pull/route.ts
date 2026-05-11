import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishJob } from "@/lib/queue/redis-queue";
import { verifyCronAuth } from "@/lib/cron-auth";
import { isEligibleForDailyPull } from "@/lib/notifications/eligibility";

async function handle(): Promise<NextResponse> {
  const now = new Date();
  const fiscalYear = now.getFullYear();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          trialEndDate: true,
          currentPeriodEnd: true,
        },
      },
      preference: { select: { notifications: true } },
      arcaCredential: { select: { isValidated: true } },
    },
  });

  const eligibleUserIds: string[] = [];
  for (const user of users) {
    const eligible = isEligibleForDailyPull({
      subscription: user.subscription,
      preference: user.preference,
      credential: user.arcaCredential,
      now,
    });
    if (eligible) eligibleUserIds.push(user.id);
  }

  if (eligibleUserIds.length === 0) {
    return NextResponse.json({
      totalUsers: 0,
      comprobantesJobs: 0,
      recibosJobs: 0,
      skipped: 0,
    });
  }

  const [activeJobs, workersByUser] = await Promise.all([
    prisma.automationJob.findMany({
      where: {
        userId: { in: eligibleUserIds },
        jobType: { in: ["PULL_COMPROBANTES", "PULL_DOMESTIC_RECEIPTS"] },
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { userId: true, jobType: true },
    }),
    prisma.domesticWorker.findMany({
      where: { userId: { in: eligibleUserIds } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const activeComprobantesUsers = new Set(
    activeJobs.filter((j) => j.jobType === "PULL_COMPROBANTES").map((j) => j.userId),
  );
  const activeRecibosUsers = new Set(
    activeJobs.filter((j) => j.jobType === "PULL_DOMESTIC_RECEIPTS").map((j) => j.userId),
  );
  const usersWithWorkers = new Set(workersByUser.map((w) => w.userId));

  const createdJobs: string[] = [];
  let comprobantesJobs = 0;
  let recibosJobs = 0;
  let skipped = 0;

  for (const userId of eligibleUserIds) {
    if (activeComprobantesUsers.has(userId)) {
      skipped++;
    } else {
      const job = await prisma.automationJob.create({
        data: {
          userId,
          jobType: "PULL_COMPROBANTES",
          fiscalYear,
          status: "PENDING",
          notifyOnComplete: true,
        },
      });
      createdJobs.push(job.id);
      comprobantesJobs++;
    }

    if (!usersWithWorkers.has(userId)) continue;

    if (activeRecibosUsers.has(userId)) {
      skipped++;
    } else {
      const job = await prisma.automationJob.create({
        data: {
          userId,
          jobType: "PULL_DOMESTIC_RECEIPTS",
          fiscalYear,
          status: "PENDING",
          notifyOnComplete: true,
        },
      });
      createdJobs.push(job.id);
      recibosJobs++;
    }
  }

  for (const id of createdJobs) {
    await publishJob(id);
  }

  return NextResponse.json({
    totalUsers: eligibleUserIds.length,
    comprobantesJobs,
    recibosJobs,
    skipped,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return handle();
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return handle();
}
