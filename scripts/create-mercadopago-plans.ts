/**
 * Bootstrap script — run once to create the MercadoPago preapproval plans.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-mercadopago-plans.ts
 *
 * After running, paste the printed env vars into your Vercel project settings
 * (Production scope), then redeploy.
 */

import { SUBSCRIPTION_PLANS, getAnnualTotal } from "../src/lib/subscription/plans";

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const baseUrl = process.env.NEXTAUTH_URL;

if (!accessToken) {
  console.error("MERCADOPAGO_ACCESS_TOKEN is not set");
  process.exit(1);
}
if (!baseUrl) {
  console.error("NEXTAUTH_URL is not set (e.g. https://desgrava.ar)");
  process.exit(1);
}

const backUrl = `${baseUrl.replace(/\/$/, "")}/configuracion?subscription=updated`;

interface PlanBody {
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "months" | "days";
    transaction_amount: number;
    currency_id: "ARS";
  };
  back_url: string;
}

interface PlanResponse {
  id: string;
  init_point: string;
}

async function createPlan(label: string, body: PlanBody): Promise<PlanResponse> {
  const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`Failed to create ${label} plan:`, json);
    process.exit(1);
  }
  return json as unknown as PlanResponse;
}

async function main() {
  const { monthlyPrice } = SUBSCRIPTION_PLANS.PERSONAL;

  const monthly = await createPlan("MONTHLY", {
    reason: "Desgrava.ar — Plan Personal (Mensual)",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: monthlyPrice,
      currency_id: "ARS",
    },
    back_url: backUrl,
  });

  const annual = await createPlan("ANNUAL", {
    reason: "Desgrava.ar — Plan Personal (Anual)",
    auto_recurring: {
      frequency: 12,
      frequency_type: "months",
      transaction_amount: getAnnualTotal(),
      currency_id: "ARS",
    },
    back_url: backUrl,
  });

  console.log("");
  console.log("Plans created. Add these to your env (Vercel + .env for local):");
  console.log("");
  console.log(`MERCADOPAGO_PLAN_MONTHLY_INIT_POINT=${monthly.init_point}`);
  console.log(`MERCADOPAGO_PLAN_ANNUAL_INIT_POINT=${annual.init_point}`);
  console.log("");
  console.log("Plan IDs (for reference, not used by the app):");
  console.log(`  MONTHLY: ${monthly.id}`);
  console.log(`  ANNUAL:  ${annual.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
