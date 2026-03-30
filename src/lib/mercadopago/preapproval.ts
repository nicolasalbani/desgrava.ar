import { PreApproval } from "mercadopago";
import { getMercadoPagoClient } from "./client";
import { SUBSCRIPTION_PLANS, getAnnualTotal } from "@/lib/subscription/plans";
import type { BillingFrequency } from "@/generated/prisma/client";

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

interface CreatePreapprovalParams {
  payerEmail: string;
  externalReference: string;
  billingFrequency: BillingFrequency;
}

interface PreapprovalResponse {
  id: string;
  init_point: string;
  status: string;
}

export async function createPreapproval(
  params: CreatePreapprovalParams,
): Promise<PreapprovalResponse> {
  const client = getMercadoPagoClient();
  const preApproval = new PreApproval(client);
  const { monthlyPrice } = SUBSCRIPTION_PLANS.PERSONAL;
  const baseUrl = getBaseUrl();

  const isAnnual = params.billingFrequency === "ANNUAL";

  const response = await preApproval.create({
    body: {
      payer_email: params.payerEmail,
      back_url: `${baseUrl}/configuracion?subscription=updated`,
      reason: isAnnual
        ? "Desgrava.ar — Plan Personal (Anual)"
        : "Desgrava.ar — Plan Personal (Mensual)",
      external_reference: params.externalReference,
      auto_recurring: {
        frequency: isAnnual ? 12 : 1,
        frequency_type: "months",
        transaction_amount: isAnnual ? getAnnualTotal() : monthlyPrice,
        currency_id: "ARS",
      },
    },
  });

  return {
    id: response.id!,
    init_point: response.init_point!,
    status: response.status!,
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
