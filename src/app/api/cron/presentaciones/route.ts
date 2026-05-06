import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishJob } from "@/lib/queue/redis-queue";
import { verifyCronAuth } from "@/lib/cron-auth";

async function handle(): Promise<NextResponse> {
  const today = new Date().getDate();

  // Find users with auto-submit enabled and matching day
  const users = await prisma.userPreference.findMany({
    where: {
      autoSubmitEnabled: true,
      autoSubmitDay: today,
    },
    select: {
      userId: true,
      defaultFiscalYear: true,
    },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: "No users scheduled today", count: 0 });
  }

  const currentYear = new Date().getFullYear();
  const jobs: { id: string }[] = [];

  for (const user of users) {
    const fiscalYear = user.defaultFiscalYear ?? currentYear;

    // Skip if there's already an active job
    const activeJob = await prisma.automationJob.findFirst({
      where: {
        userId: user.userId,
        jobType: "SUBMIT_PRESENTACION",
        status: { in: ["PENDING", "RUNNING"] },
      },
    });
    if (activeJob) continue;

    const job = await prisma.automationJob.create({
      data: {
        userId: user.userId,
        jobType: "SUBMIT_PRESENTACION",
        fiscalYear,
        status: "PENDING",
      },
    });

    jobs.push(job);
  }

  // Enqueue every job for the worker pool to consume.
  for (const job of jobs) {
    await publishJob(job.id);
  }

  return NextResponse.json({
    message: `Created ${jobs.length} presentación jobs`,
    count: jobs.length,
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
