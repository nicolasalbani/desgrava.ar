import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAttentionCounts } from "@/lib/attention/counts";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fiscalYear = req.nextUrl.searchParams.get("fiscalYear");

  const counts = await getAttentionCounts(
    session.user.id,
    fiscalYear ? parseInt(fiscalYear) : undefined,
  );

  return NextResponse.json(counts);
}
