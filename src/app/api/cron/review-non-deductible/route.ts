import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { reviewNonDeductibleCatalog } from "@/lib/catalog/review-non-deductible";
import { verifyCronAuth } from "@/lib/cron-auth";

function handle(): NextResponse {
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

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return handle();
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return handle();
}
