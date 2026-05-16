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

interface AuthorizedPaymentResponse {
  id: number | string;
  preapproval_id?: string;
  status?: string;
}

/**
 * Fetches an authorized_payment (recurring payment) from MercadoPago.
 * Used by the webhook handler to resolve the parent preapproval ID for
 * `subscription_authorized_payment` events — the SDK does not expose this
 * endpoint so we call the REST API directly.
 */
export async function getAuthorizedPayment(id: string): Promise<AuthorizedPaymentResponse | null> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
  }

  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch authorized_payment ${id}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as AuthorizedPaymentResponse;
}

interface PreapprovalSearchResult {
  id: string;
  status?: string;
  date_created?: string;
}

/**
 * Searches for preapprovals by `external_reference` (= userId in our flow).
 * Returns the most recently created preapproval, or null if none exist.
 * Used by the manual sync endpoint to recover from missed webhooks.
 */
export async function findLatestPreapprovalByExternalReference(
  externalReference: string,
): Promise<PreapprovalSearchResult | null> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
  }

  const url = new URL("https://api.mercadopago.com/preapproval/search");
  url.searchParams.set("external_reference", externalReference);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Preapproval search failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { results?: PreapprovalSearchResult[] };
  return body.results?.[0] ?? null;
}
