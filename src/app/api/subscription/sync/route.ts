import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processSubscriptionWebhook } from "@/lib/mercadopago/webhooks";

/**
 * Manual recovery endpoint — re-runs the webhook upsert against the user's
 * stored `mercadoPagoPreapprovalId`. Useful when a webhook is missed
 * (signature mismatch, URL not registered, MP delivery failure, etc.).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    const preapprovalId = subscription?.mercadoPagoPreapprovalId ?? null;
    if (!preapprovalId) {
      return NextResponse.json(
        { error: "No encontramos ninguna suscripción en MercadoPago para tu cuenta." },
        { status: 404 },
      );
    }

    await processSubscriptionWebhook(preapprovalId);

    const updated = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ status: updated?.status ?? null });
  } catch (err) {
    console.error("Subscription sync error:", err);
    return NextResponse.json({ error: "Error al sincronizar la suscripción" }, { status: 500 });
  }
}
