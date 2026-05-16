import { prisma } from "@/lib/prisma";
import { getPreapproval } from "./preapproval";
import type { BillingFrequency, SubscriptionStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Maps MercadoPago preapproval status to our SubscriptionStatus.
 */
export function mapMPStatus(mpStatus: string): SubscriptionStatus | null {
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
 * Maps MercadoPago `auto_recurring.frequency` (months) to our BillingFrequency.
 * 12 months → ANNUAL, anything else → MONTHLY.
 */
export function mapMPBillingFrequency(frequencyMonths: number | undefined): BillingFrequency {
  return frequencyMonths === 12 ? "ANNUAL" : "MONTHLY";
}

interface PreapprovalSnapshot {
  status: string;
  external_reference: string | null;
  next_payment_date: string | null;
  frequencyMonths: number | undefined;
}

interface MutationFields {
  status: SubscriptionStatus;
  billingFrequency: BillingFrequency;
  mercadoPagoPreapprovalId: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
}

/**
 * Pure helper — given the preapproval snapshot, builds the fields we want to
 * write on the Subscription row. Returns null if the MP status doesn't map to
 * one of our known states.
 */
export function buildSubscriptionMutation(
  snapshot: PreapprovalSnapshot,
  preapprovalId: string,
  now: Date,
): MutationFields | null {
  const status = mapMPStatus(snapshot.status);
  if (!status) return null;

  const fields: MutationFields = {
    status,
    billingFrequency: mapMPBillingFrequency(snapshot.frequencyMonths),
    mercadoPagoPreapprovalId: preapprovalId,
  };

  if (status === "ACTIVE") {
    fields.currentPeriodStart = now;
    if (snapshot.next_payment_date) {
      fields.currentPeriodEnd = new Date(snapshot.next_payment_date);
    }
  }

  if (status === "CANCELLED") {
    fields.cancelledAt = now;
  }

  return fields;
}

/**
 * Processes a MercadoPago webhook notification for subscription events.
 *
 * Flow (plan-based): the preapproval carries `external_reference = userId`
 * (set when we build the checkout URL). We use that to upsert the local
 * Subscription row keyed by userId. Falls back to lookup by preapproval ID
 * for legacy rows created before the plan-flow migration.
 */
export async function processSubscriptionWebhook(preapprovalId: string): Promise<void> {
  const mpPreapproval = await getPreapproval(preapprovalId);
  if (!mpPreapproval) return;

  const fields = buildSubscriptionMutation(
    {
      status: mpPreapproval.status ?? "",
      external_reference: mpPreapproval.external_reference ?? null,
      next_payment_date: mpPreapproval.next_payment_date ?? null,
      frequencyMonths: mpPreapproval.auto_recurring?.frequency,
    },
    preapprovalId,
    new Date(),
  );
  if (!fields) return;

  const userId = mpPreapproval.external_reference;

  if (userId) {
    const create: Prisma.SubscriptionUncheckedCreateInput = {
      userId,
      plan: "PERSONAL",
      ...fields,
    };
    await prisma.subscription.upsert({
      where: { userId },
      update: fields,
      create,
    });
    return;
  }

  // Legacy fallback: preapprovals created before the plan flow don't carry
  // external_reference. Look them up by the preapproval ID we stored at
  // checkout time.
  const existing = await prisma.subscription.findUnique({
    where: { mercadoPagoPreapprovalId: preapprovalId },
  });
  if (!existing) return;
  await prisma.subscription.update({
    where: { id: existing.id },
    data: fields,
  });
}
