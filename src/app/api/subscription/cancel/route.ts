import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPreapproval } from "@/lib/mercadopago/preapproval";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!subscription) {
    return NextResponse.json({ error: "No tenés una suscripción" }, { status: 400 });
  }

  if (subscription.plan === "FOUNDERS") {
    return NextResponse.json(
      { error: "Los usuarios Founders no pueden cancelar su plan" },
      { status: 400 },
    );
  }

  if (subscription.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Solo se pueden cancelar suscripciones activas" },
      { status: 400 },
    );
  }

  try {
    // Cancel on MercadoPago if there's a preapproval ID
    if (subscription.mercadoPagoPreapprovalId) {
      await cancelPreapproval(subscription.mercadoPagoPreapprovalId);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Error al cancelar la suscripción" }, { status: 500 });
  }
}
