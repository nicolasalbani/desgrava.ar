import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttentionCounts, type AttentionCounts } from "@/lib/attention/counts";
import { withPrivateSWR } from "@/lib/http/cache-headers";

export interface PanelCountsResponse {
  attention: AttentionCounts;
  domesticWorkers: number;
  employers: number;
}

/**
 * Consolidated counts endpoint feeding the dashboard nav + provider tree.
 *
 * Replaces three separate fetches: `/api/attention-counts`,
 * `/api/trabajadores?count=true`, and `/api/empleadores?count=true`.
 * One round trip, one DB connection, one cached response.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fiscalYearParam = req.nextUrl.searchParams.get("fiscalYear");
  const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : undefined;

  const [attention, domesticWorkers, employers] = await Promise.all([
    getAttentionCounts(session.user.id, fiscalYear),
    prisma.domesticWorker.count({
      where: {
        userId: session.user.id,
        ...(fiscalYear ? { fiscalYear } : {}),
      },
    }),
    prisma.employer.count({
      where: {
        userId: session.user.id,
        ...(fiscalYear ? { fiscalYear } : {}),
      },
    }),
  ]);

  const body: PanelCountsResponse = { attention, domesticWorkers, employers };

  return NextResponse.json(body, {
    headers: { "Cache-Control": withPrivateSWR(5, 30) },
  });
}
