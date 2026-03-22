import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/automation/job-processor";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  // Process all jobs in background
  after(async () => {
    for (const job of jobs) {
      try {
        await processJob(job.id);
      } catch (err) {
        console.error(`Cron job processing error for job ${job.id}:`, err);
      }
    }
  });

  return NextResponse.json({
    message: `Created ${jobs.length} presentación jobs`,
    count: jobs.length,
  });
}
