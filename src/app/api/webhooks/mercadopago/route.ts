import { NextRequest, NextResponse } from "next/server";
import { processSubscriptionWebhook } from "@/lib/mercadopago/webhooks";
import { getAuthorizedPayment } from "@/lib/mercadopago/preapproval";
import crypto from "crypto";

/**
 * Builds the MercadoPago signature manifest string.
 * Template: `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
 * Exported for unit testing.
 */
export function buildManifest(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

/**
 * Parses the MercadoPago `x-signature` header (`ts=...,v1=...`).
 * Exported for unit testing.
 */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key && value) parts[key] = value;
  }
  if (!parts["ts"] || !parts["v1"]) return null;
  return { ts: parts["ts"], v1: parts["v1"] };
}

/**
 * Validates the MercadoPago webhook signature.
 *
 * IMPORTANT: per MP docs, `data.id` in the signature template must come from
 * the URL query string, NOT the body. For some event types (e.g.
 * `subscription_authorized_payment`) the URL and body values diverge.
 */
function validateSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const parsed = parseSignatureHeader(req.headers.get("x-signature"));
  if (!parsed) return false;

  const manifest = buildManifest(dataId, req.headers.get("x-request-id") ?? "", parsed.ts);
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return hmac === parsed.v1;
}

export async function POST(req: NextRequest) {
  // Read data.id from URL query first (signature is computed over this value),
  // fall back to body for clients that omit the query param.
  const urlDataId = req.nextUrl.searchParams.get("data.id");
  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    data?: { id?: string | number };
  };
  const dataId = urlDataId ?? (body.data?.id != null ? String(body.data.id) : undefined);
  const type = body.type ?? req.nextUrl.searchParams.get("type") ?? undefined;

  if (!dataId) {
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 });
  }

  if (!validateSignature(req, dataId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    if (type === "subscription_preapproval") {
      await processSubscriptionWebhook(dataId);
    } else if (type === "subscription_authorized_payment") {
      // `data.id` here is the authorized_payment ID — resolve the parent
      // preapproval ID before syncing.
      const authorizedPayment = await getAuthorizedPayment(dataId);
      const preapprovalId = authorizedPayment?.preapproval_id;
      if (preapprovalId) {
        await processSubscriptionWebhook(preapprovalId);
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Return 200 anyway to prevent MP from retrying
  }

  return NextResponse.json({ received: true });
}
