import { NextRequest, NextResponse } from "next/server";
import { simuladorInputSchema } from "@/lib/simulador/schemas";
import { simulate } from "@/lib/simulador/calculator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = simuladorInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = simulate(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en simulador:", error);
    return NextResponse.json(
      { error: "Error al calcular" },
      { status: 500 }
    );
  }
}
