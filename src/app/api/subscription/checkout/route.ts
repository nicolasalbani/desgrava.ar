import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPreapproval } from "@/lib/mercadopago/preapproval";
import type { BillingFrequency } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const billingFrequency: BillingFrequency =
    body.billingFrequency === "ANNUAL" ? "ANNUAL" : "MONTHLY";

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (subscription?.plan === "FOUNDERS") {
    return NextResponse.json(
      { error: "Los usuarios Founders ya tienen acceso completo" },
      { status: 400 },
    );
  }

  if (subscription?.status === "ACTIVE") {
    return NextResponse.json({ error: "Ya tenés una suscripción activa" }, { status: 400 });
  }

  try {
    const result = await createPreapproval({
      payerEmail: session.user.email,
      externalReference: session.user.id,
      billingFrequency,
    });

    // Update subscription with the MP preapproval ID and billing frequency
    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          mercadoPagoPreapprovalId: result.id,
          billingFrequency,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: session.user.id,
          plan: "PERSONAL",
          status: "TRIALING",
          mercadoPagoPreapprovalId: result.id,
          billingFrequency,
        },
      });
    }

    return NextResponse.json({ initPoint: result.init_point });
  } catch (err) {
    console.error("MercadoPago checkout error:", err);
    return NextResponse.json(
      { error: "Error al crear la suscripción en MercadoPago" },
      { status: 500 },
    );
  }
}
