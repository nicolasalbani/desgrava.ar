import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveCategory, getCatalogEntry } from "@/lib/catalog/provider-catalog";
import { classifyCategory, classifyCategoryByKeywords } from "@/lib/ocr/category-classifier";

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

    // Fast keyword-based classification — runs before catalog or OpenAI
    const keywordCategory = classifyCategoryByKeywords(text);
    if (keywordCategory) {
      return NextResponse.json({ category: keywordCategory });
    }

    // Normalize CUIT: strip dashes so formatted values like "20-22430704-8" are accepted
    const normalizedCuit = cuit && typeof cuit === "string" ? cuit.replace(/-/g, "") : null;

    // If CUIT provided, use the catalog-aware resolver (writes to ProviderCatalog)
    if (normalizedCuit && /^\d{11}$/.test(normalizedCuit)) {
      // Check catalog first — may already be resolved
      const existing = await getCatalogEntry(normalizedCuit);
      if (existing) {
        return NextResponse.json({ category: existing.deductionCategory });
      }

      // Classify and write to catalog
      const category = await resolveCategory({ cuit: normalizedCuit, pdfText: text });
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
