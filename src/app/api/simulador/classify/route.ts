import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalogEntry, resolveCategory } from "@/lib/catalog/provider-catalog";

const classifySchema = z.object({
  cuit: z.string().min(1),
  ocrText: z.string().optional(),
  providerName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = classifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { cuit, ocrText, providerName } = parsed.data;

    // Quick catalog lookup first
    const catalogEntry = await getCatalogEntry(cuit);
    if (catalogEntry) {
      return NextResponse.json({
        category: catalogEntry.deductionCategory,
        providerName: catalogEntry.razonSocial ?? providerName ?? null,
        source: "catalog",
      });
    }

    // AI fallback
    const category = await resolveCategory({
      cuit,
      providerName,
      pdfText: ocrText,
    });

    // Re-fetch catalog to get razonSocial (resolveCategory may have created an entry)
    const updatedEntry = await getCatalogEntry(cuit);

    return NextResponse.json({
      category,
      providerName: updatedEntry?.razonSocial ?? providerName ?? null,
      source: "ai",
    });
  } catch (error) {
    console.error("Error classifying:", error);
    return NextResponse.json({ error: "Error al clasificar" }, { status: 500 });
  }
}
