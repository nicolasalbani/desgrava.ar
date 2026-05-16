import { PreApproval } from "mercadopago";
import { getMercadoPagoClient } from "./client";
import type { BillingFrequency } from "@/generated/prisma/client";

/**
 * Returns the MercadoPago plan init_point for the given billing frequency,
 * with `external_reference` appended so we can link the resulting preapproval
 * back to the user when MP fires the webhook.
 *
 * The plan init_points are created once via `scripts/create-mercadopago-plans.ts`
 * and provided via env vars. This decouples checkout from the user's account
 * email — they can pay with any MP account.
 */
export function getCheckoutUrl(
  billingFrequency: BillingFrequency,
  externalReference: string,
): string {
  const initPoint =
    billingFrequency === "ANNUAL"
      ? process.env.MERCADOPAGO_PLAN_ANNUAL_INIT_POINT
      : process.env.MERCADOPAGO_PLAN_MONTHLY_INIT_POINT;

  if (!initPoint) {
    throw new Error(
      `MercadoPago plan init_point is not configured for ${billingFrequency}. ` +
        `Run scripts/create-mercadopago-plans.ts and set the env vars.`,
    );
  }

  const url = new URL(initPoint);
  url.searchParams.set("external_reference", externalReference);
  return url.toString();
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  const client = getMercadoPagoClient();
  const preApproval = new PreApproval(client);

  await preApproval.update({
    id: preapprovalId,
    body: { status: "cancelled" },
  });
}

export async function getPreapproval(preapprovalId: string) {
  const client = getMercadoPagoClient();
  const preApproval = new PreApproval(client);

  return preApproval.get({ id: preapprovalId });
}
