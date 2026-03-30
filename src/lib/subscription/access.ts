import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/client";

export interface UserAccess {
  canWrite: boolean;
  status: SubscriptionStatus | null;
  plan: SubscriptionPlan | null;
  trialEndDate: Date | null;
  currentPeriodEnd: Date | null;
}

/**
 * Determines a user's subscription access level.
 * Returns canWrite: true if the user has an active, trialing (not expired),
 * or cancelled (within period) subscription, or is a FOUNDERS user.
 */
export async function getUserAccess(userId: string): Promise<UserAccess> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return {
      canWrite: false,
      status: null,
      plan: null,
      trialEndDate: null,
      currentPeriodEnd: null,
    };
  }

  const now = new Date();
  const canWrite = resolveCanWrite(subscription.plan, subscription.status, now, {
    trialEndDate: subscription.trialEndDate,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });

  return {
    canWrite,
    status: subscription.status,
    plan: subscription.plan,
    trialEndDate: subscription.trialEndDate,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export function resolveCanWrite(
  plan: SubscriptionPlan,
  status: SubscriptionStatus,
  now: Date,
  dates: { trialEndDate: Date | null; currentPeriodEnd: Date | null },
): boolean {
  // Founders always have full access
  if (plan === "FOUNDERS") return true;

  switch (status) {
    case "ACTIVE":
      return true;
    case "TRIALING":
      // Trial is valid only if not expired
      return dates.trialEndDate ? now < dates.trialEndDate : false;
    case "CANCELLED":
      // Cancelled users keep access until current period ends
      return dates.currentPeriodEnd ? now < dates.currentPeriodEnd : false;
    case "PAST_DUE":
    case "EXPIRED":
      return false;
    default:
      return false;
  }
}

/**
 * Quick check for API routes. Returns true if user can perform write operations.
 */
export async function canUserWrite(userId: string): Promise<boolean> {
  const access = await getUserAccess(userId);
  return access.canWrite;
}
