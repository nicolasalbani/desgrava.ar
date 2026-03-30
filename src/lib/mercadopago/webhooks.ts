import { prisma } from "@/lib/prisma";
import { getPreapproval } from "./preapproval";
import type { SubscriptionStatus } from "@/generated/prisma/client";

/**
 * Maps MercadoPago preapproval status to our SubscriptionStatus.
 */
function mapMPStatus(mpStatus: string): SubscriptionStatus | null {
  switch (mpStatus) {
    case "authorized":
      return "ACTIVE";
    case "paused":
    case "pending":
      return "PAST_DUE";
    case "cancelled":
      return "CANCELLED";
    default:
      return null;
  }
}

/**
 * Processes a MercadoPago webhook notification for subscription events.
 * Fetches the preapproval from MP to get the current state, then updates our DB.
 */
export async function processSubscriptionWebhook(preapprovalId: string): Promise<void> {
  // Fetch the current state from MercadoPago
  const mpPreapproval = await getPreapproval(preapprovalId);
  if (!mpPreapproval) return;

  const newStatus = mapMPStatus(mpPreapproval.status!);
  if (!newStatus) return;

  // Find our subscription by MP preapproval ID
  const subscription = await prisma.subscription.findUnique({
    where: { mercadoPagoPreapprovalId: preapprovalId },
  });

  if (!subscription) return;

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "ACTIVE") {
    // Set period dates from MP's next_payment_date
    const nextPaymentDate = mpPreapproval.next_payment_date
      ? new Date(mpPreapproval.next_payment_date)
      : null;

    updateData.currentPeriodStart = now;
    if (nextPaymentDate) {
      updateData.currentPeriodEnd = nextPaymentDate;
    }
  }

  if (newStatus === "CANCELLED") {
    updateData.cancelledAt = now;
    // Keep currentPeriodEnd so user retains access until then
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: updateData,
  });
}
