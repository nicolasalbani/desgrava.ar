import { prisma } from "@/lib/prisma";
import { SubscriptionCard } from "@/components/dashboard/subscription-card";

interface SubscriptionSectionProps {
  userId: string;
}

export async function SubscriptionSection({ userId }: SubscriptionSectionProps) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  return (
    <SubscriptionCard
      subscription={
        subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              trialEndDate: subscription.trialEndDate?.toISOString() ?? null,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
