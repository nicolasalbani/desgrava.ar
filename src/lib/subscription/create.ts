import { prisma } from "@/lib/prisma";
import { TRIAL_DURATION_DAYS } from "./plans";

/**
 * Creates a trial subscription for a newly registered user.
 * Safe to call multiple times — skips if subscription already exists.
 */
export async function createTrialSubscription(userId: string): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (existing) return;

  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.subscription.create({
    data: {
      userId,
      plan: "PERSONAL",
      status: "TRIALING",
      trialStartDate: now,
      trialEndDate: trialEnd,
    },
  });
}
