import { NextRequest, NextResponse } from "next/server";
import { processSubscriptionWebhook } from "@/lib/mercadopago/webhooks";
import crypto from "crypto";

/**
 * Validates the MercadoPago webhook signature.
 * MP sends x-signature header with ts and v1 values.
 * v1 = HMAC-SHA256(id:ts:secret_key, webhook_secret)
 */
function validateSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const xSignature = req.headers.get("x-signature");
  if (!xSignature) return false;

  // Parse ts and v1 from x-signature header: "ts=...,v1=..."
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key && value) parts[key] = value;
  }

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Build the manifest string and compute HMAC
  const manifest = `id:${dataId};request-id:${req.headers.get("x-request-id") ?? ""};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return hmac === v1;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // MercadoPago sends { action, type, data: { id } }
  const type = body.type as string | undefined;
  const dataId = body.data?.id as string | undefined;

  if (!dataId) {
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 });
  }

  // Validate webhook signature
  if (!validateSignature(req, dataId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Only process subscription-related events
  if (type === "subscription_preapproval") {
    try {
      await processSubscriptionWebhook(dataId);
    } catch (err) {
      console.error("Webhook processing error:", err);
      // Return 200 anyway to prevent MP from retrying
    }
  }

  return NextResponse.json({ received: true });
}
