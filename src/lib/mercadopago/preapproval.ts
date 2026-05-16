import { PreApproval } from "mercadopago";
import { getMercadoPagoClient } from "./client";
import type { BillingFrequency } from "@/generated/prisma/client";

interface PreapprovalCreationResult {
  id: string;
  init_point: string;
}

/**
 * Extracts the `preapproval_plan_id` query param from a plan init_point URL.
 * The init_points are stored as env vars; we extract the plan ID at call time
 * so the bootstrap script (which only prints init_points) remains the single
 * source of truth.
 */
function extractPlanIdFromInitPoint(initPoint: string): string {
  const url = new URL(initPoint);
  const id = url.searchParams.get("preapproval_plan_id");
  if (!id) {
    throw new Error(`init_point is missing preapproval_plan_id query param: ${initPoint}`);
  }
  return id;
}

function getPlanId(billingFrequency: BillingFrequency): string {
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
  return extractPlanIdFromInitPoint(initPoint);
}

/**
 * Creates a MercadoPago preapproval bound to one of our plans, with our
 * `external_reference` so the webhook can map it back to the user.
 *
 * IMPORTANT: we deliberately omit `payer_email`. MP only carries
 * external_reference on preapprovals created via this POST endpoint — the
 * plan-init-point flow (where the user clicks `?external_reference=...&...`)
 * does NOT propagate external_reference to the resulting preapproval, even
 * though MP's search endpoint can still find it. Omitting payer_email lets
 * the user pay with any MP account.
 */
export async function createPreapproval(
  billingFrequency: BillingFrequency,
  externalReference: string,
): Promise<PreapprovalCreationResult> {
  const client = getMercadoPagoClient();
  const preApproval = new PreApproval(client);
  const preapprovalPlanId = getPlanId(billingFrequency);

  const response = await preApproval.create({
    body: {
      preapproval_plan_id: preapprovalPlanId,
      external_reference: externalReference,
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error("MercadoPago preapproval response missing id or init_point");
  }

  return {
    id: response.id,
    init_point: response.init_point,
  };
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
