/**
 * Worker entrypoint — pulls jobs from the Redis queue and runs Playwright
 * automation against ARCA / SiRADIG.
 *
 * The worker is platform-agnostic: it requires only outbound network access to
 * Redis and Postgres. The same Docker image runs on Fly.io and on any
 * self-hosted Linux box.
 *
 * Per-user serialization is enforced with a Redis distributed lock. If a job
 * arrives for a user that another worker is already busy with, the worker
 * re-queues it after a small backoff so a different worker (or the same one
 * later) can take it.
 */

import os from "node:os";
import { processJob } from "@/lib/automation/job-processor";
import { prismaDirectClient as prisma } from "@/lib/prisma";
import {
  acquireUserLock,
  consumeJob,
  disconnect as disconnectQueue,
  extendUserLock,
  generateLockToken,
  publishJob,
  releaseUserLock,
} from "@/lib/queue/redis-queue";

const WORKER_ID = process.env.WORKER_ID ?? os.hostname();
const CONCURRENCY = clampPositiveInt(process.env.WORKER_CONCURRENCY, 10);
const BRPOP_TIMEOUT_SEC = 5;
const LOCK_TTL_SEC = 15 * 60; // 15 minutes — covers the longest expected job
const LOCK_HEARTBEAT_MS = 60_000; // 1 minute
const REPUSH_BACKOFF_MS = 2_000;
const SHUTDOWN_DRAIN_MS = 30_000;

let shuttingDown = false;
const inflight = new Set<Promise<void>>();

function clampPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOne(jobId: string): Promise<void> {
  let userId: string | null = null;
  try {
    const job = await prisma.automationJob.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (!job) {
      console.warn(`[worker:${WORKER_ID}] job ${jobId} not found, skipping`);
      return;
    }

    userId = job.userId;
    const token = generateLockToken();
    const acquired = await acquireUserLock(userId, token, LOCK_TTL_SEC);

    if (!acquired) {
      // Another worker is busy with this user. Re-queue with a small backoff.
      await sleep(REPUSH_BACKOFF_MS);
      await publishJob(jobId);
      return;
    }

    const heartbeat = setInterval(() => {
      extendUserLock(userId!, token, LOCK_TTL_SEC).catch((err) => {
        console.error(`[worker:${WORKER_ID}] lock heartbeat failed for ${userId}:`, err);
      });
    }, LOCK_HEARTBEAT_MS);

    try {
      await processJob(jobId);
    } finally {
      clearInterval(heartbeat);
      await releaseUserLock(userId, token).catch((err) => {
        console.error(`[worker:${WORKER_ID}] lock release failed for ${userId}:`, err);
      });
    }
  } catch (err) {
    // processJob marks DB FAILED on errors it catches internally. This outer
    // catch is a safety net for anything that escapes (e.g. DB outage).
    console.error(`[worker:${WORKER_ID}] uncaught error on job ${jobId}:`, err);
    await prisma.automationJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Worker error",
          completedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

async function loop(): Promise<void> {
  console.log(
    `[worker:${WORKER_ID}] started — concurrency=${CONCURRENCY}, brpop_timeout=${BRPOP_TIMEOUT_SEC}s`,
  );

  while (!shuttingDown) {
    // Wait for capacity if we're at the concurrency cap.
    while (inflight.size >= CONCURRENCY && !shuttingDown) {
      await Promise.race(inflight);
    }
    if (shuttingDown) break;

    let jobId: string | null = null;
    try {
      jobId = await consumeJob(BRPOP_TIMEOUT_SEC);
    } catch (err) {
      // Connection blip — back off briefly and retry.
      console.error(`[worker:${WORKER_ID}] consumeJob error:`, err);
      await sleep(1_000);
      continue;
    }
    if (!jobId) continue;

    const p = processOne(jobId).finally(() => {
      inflight.delete(p);
    });
    inflight.add(p);
  }

  console.log(
    `[worker:${WORKER_ID}] draining ${inflight.size} in-flight job(s) (timeout ${SHUTDOWN_DRAIN_MS}ms)`,
  );
  await Promise.race([
    Promise.all([...inflight]),
    sleep(SHUTDOWN_DRAIN_MS).then(() => {
      if (inflight.size > 0) {
        console.warn(
          `[worker:${WORKER_ID}] drain timeout — ${inflight.size} job(s) still in flight`,
        );
      }
    }),
  ]);
}

function installShutdownHandlers() {
  const handler = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker:${WORKER_ID}] received ${signal}, draining...`);
  };
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
}

async function main(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is not set — worker cannot start");
    process.exit(1);
  }

  installShutdownHandlers();
  try {
    await loop();
  } finally {
    await disconnectQueue().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
  console.log(`[worker:${WORKER_ID}] exited cleanly`);
}

main().catch((err) => {
  console.error(`[worker:${WORKER_ID}] fatal error:`, err);
  process.exit(1);
});
