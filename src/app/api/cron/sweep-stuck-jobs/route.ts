import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { STUCK_THRESHOLD_MS, stuckCutoff } from "@/lib/automation/stuck-jobs";

/**
 * Sweep `RUNNING` automation jobs whose progress hasn't advanced for longer
 * than `STUCK_THRESHOLD_MS`, marking each `FAILED`. Runs as a Vercel Cron
 * every 5 minutes. This protects users from a stuck UI when a worker dies
 * hard mid-job (the Redis user-lock TTL eventually expires, but the DB row
 * stays in `RUNNING` forever without this sweep).
 *
 * Idempotent: each transition uses `updateMany` with a CAS on `status`, so
 * if a worker happens to finish the job between our read and write, we
 * skip it and the count we report is the actual number we transitioned.
 */
async function handle(): Promise<NextResponse> {
  const now = new Date();
  const cutoff = stuckCutoff(now);

  // Find candidate stuck jobs. A null `currentStepStartedAt` falls back to
  // `startedAt` so a job that crashed in setup (before recording any step) is
  // also caught.
  const candidates = await prisma.automationJob.findMany({
    where: {
      status: "RUNNING",
      OR: [
        { currentStepStartedAt: { lt: cutoff } },
        { AND: [{ currentStepStartedAt: null }, { startedAt: { lt: cutoff } }] },
      ],
    },
    select: {
      id: true,
      userId: true,
      jobType: true,
      currentStep: true,
      logs: true,
      startedAt: true,
      currentStepStartedAt: true,
    },
  });

  let swept = 0;
  for (const job of candidates) {
    const stamp = new Date().toLocaleTimeString("es-AR");
    const minutes = Math.floor(STUCK_THRESHOLD_MS / 60_000);
    const message = `Worker desapareció — job marcado FAILED por sweep-stuck-jobs (sin progreso por ${minutes}+ minutos).`;
    const existingLogs = Array.isArray(job.logs) ? (job.logs as string[]) : [];
    const nextLogs = [...existingLogs, `[${stamp}] ${message}`];

    const result = await prisma.automationJob.updateMany({
      where: { id: job.id, status: "RUNNING" },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: now,
        logs: nextLogs,
      },
    });
    swept += result.count;
    if (result.count === 0) {
      // Race: a worker finished or cancelled the job concurrently. Fine.
      continue;
    }
    console.log(
      `[sweep-stuck-jobs] marked job ${job.id} (${job.jobType}, user ${job.userId}) FAILED`,
    );
  }

  return NextResponse.json({
    swept,
    candidates: candidates.length,
    thresholdMinutes: Math.floor(STUCK_THRESHOLD_MS / 60_000),
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
