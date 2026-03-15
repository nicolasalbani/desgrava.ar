import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveCategory, getCatalogEntry } from "@/lib/catalog/provider-catalog";
import { classifyCategory } from "@/lib/ocr/category-classifier";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { text, cuit } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json({ error: "Texto insuficiente para clasificar" }, { status: 400 });
    }

    // If CUIT provided, use the catalog-aware resolver
    if (cuit && typeof cuit === "string" && /^\d{11}$/.test(cuit)) {
      // Check catalog first — may already be resolved
      const existing = await getCatalogEntry(cuit);
      if (existing) {
        return NextResponse.json({ category: existing.deductionCategory });
      }

      // Classify and write to catalog
      const category = await resolveCategory({ cuit, pdfText: text });
      return NextResponse.json({ category });
    }

    // No CUIT — classify without catalog
    const category = await classifyCategory(text);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error classifying category:", error);
    return NextResponse.json({ error: "Error al clasificar categoría" }, { status: 500 });
  }
}
