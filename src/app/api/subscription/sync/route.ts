import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findLatestPreapprovalByExternalReference } from "@/lib/mercadopago/preapproval";
import { processSubscriptionWebhook } from "@/lib/mercadopago/webhooks";

/**
 * Manual recovery endpoint — fetches the user's latest MercadoPago preapproval
 * (by external_reference) and runs the same upsert logic the webhook uses.
 * Useful when a webhook is missed (signature mismatch, URL not registered,
 * MP delivery failure, etc.).
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

    // First, try the preapproval ID we already have on file.
    let preapprovalId = subscription?.mercadoPagoPreapprovalId ?? null;

    if (!preapprovalId) {
      const result = await findLatestPreapprovalByExternalReference(session.user.id);
      preapprovalId = result?.id ?? null;
    }

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
