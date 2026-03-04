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
  console.log(`[EMAIL_INBOUND] event.type=${event.type}`);
  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  // 4. Respond immediately, process in background
  const { email_id, from, to, subject } = event.data;
  console.log(`[EMAIL_INBOUND] received email_id=${email_id} from=${from} to=${JSON.stringify(to)} subject=${subject}`);

  after(async () => {
    console.log(`[EMAIL_INGEST] starting background processing for email_id=${email_id}`);
    try {
      const result = await processInboundEmail(email_id, to, from, subject);
      console.log(`[EMAIL_INGEST] done email_id=${email_id} invoicesCreated=${result.invoicesCreated} errors=${JSON.stringify(result.errors)}`);
    } catch (err) {
      console.error(`[EMAIL_INGEST] unhandled error for email_id=${email_id}:`, err);
    }
  });

  return NextResponse.json({ received: true });
}
