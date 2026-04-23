import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { reviewNonDeductibleCatalog } from "@/lib/catalog/review-non-deductible";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  after(async () => {
    try {
      const summary = await reviewNonDeductibleCatalog();
      console.log("Review non-deductible catalog summary:", summary);
    } catch (err) {
      console.error("Review non-deductible catalog error:", err);
    }
  });

  return NextResponse.json({ message: "Review started" });
}
