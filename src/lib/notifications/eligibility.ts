import type { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/client";
import { resolveCanWrite } from "@/lib/subscription/access";

export interface DailyPullEligibilityInput {
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    trialEndDate: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
  preference: { notifications: boolean } | null;
  credential: { isValidated: boolean } | null;
  now: Date;
}

export function isEligibleForDailyPull(input: DailyPullEligibilityInput): boolean {
  if (!input.subscription) return false;
  if (!input.credential?.isValidated) return false;
  if (input.preference && input.preference.notifications === false) return false;

  return resolveCanWrite(input.subscription.plan, input.subscription.status, input.now, {
    trialEndDate: input.subscription.trialEndDate,
    currentPeriodEnd: input.subscription.currentPeriodEnd,
  });
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function shouldSendNotificationToday(lastNotifiedAt: Date | null, now: Date): boolean {
  if (!lastNotifiedAt) return true;
  return lastNotifiedAt.getTime() < startOfUtcDay(now);
}
