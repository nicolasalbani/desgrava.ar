import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { classifyCategory } from "@/lib/ocr/category-classifier";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Texto insuficiente para clasificar" },
        { status: 400 }
      );
    }

    const category = await classifyCategory(text);

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error classifying category:", error);
    return NextResponse.json(
      { error: "Error al clasificar categoría" },
      { status: 500 }
    );
  }
}
