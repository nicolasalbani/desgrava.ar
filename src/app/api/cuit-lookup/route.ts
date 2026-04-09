import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lookupCuit360, lookupCuitOnline } from "@/lib/catalog/provider-catalog";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuit = req.nextUrl.searchParams.get("cuit");
  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return NextResponse.json({ error: "CUIT inválido" }, { status: 400 });
  }

  const result360 = await lookupCuit360(cuit);
  if (result360?.razonSocial) {
    return NextResponse.json({ razonSocial: result360.razonSocial });
  }

  const resultOnline = await lookupCuitOnline(cuit);
  return NextResponse.json({
    razonSocial: resultOnline?.razonSocial ?? null,
  });
}
