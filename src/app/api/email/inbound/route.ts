import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { Resend } from "resend";
import { processInboundEmail } from "@/lib/email/ingest";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function POST(req: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing signature headers" },
      { status: 401 }
    );
  }

  // 2. Verify webhook signature using Resend SDK
  let event;
  try {
    event = getResend().webhooks.verify({
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  // 3. Only process email.received events
  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  // 4. Respond immediately, process in background
  const { email_id, from, to, subject } = event.data;

  after(async () => {
    try {
      await processInboundEmail(email_id, to, from, subject);
    } catch (err) {
      console.error("Error processing inbound email:", err);
    }
  });

  return NextResponse.json({ received: true });
}
