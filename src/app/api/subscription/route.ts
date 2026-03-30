import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAccess } from "@/lib/subscription/access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const access = await getUserAccess(session.user.id);

  return NextResponse.json({
    canWrite: access.canWrite,
    status: access.status,
    plan: access.plan,
    trialEndDate: access.trialEndDate,
    currentPeriodEnd: access.currentPeriodEnd,
  });
}
