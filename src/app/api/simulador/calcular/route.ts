import { NextRequest, NextResponse } from "next/server";
import { simuladorInputSchema, simuladorSimplifiedInputSchema } from "@/lib/simulador/schemas";
import { simulate, simulateSimplified } from "@/lib/simulador/calculator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Try simplified mode first (no salary field)
    if (!("salarioBrutoMensual" in body)) {
      const parsed = simuladorSimplifiedInputSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Datos invalidos", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const result = simulateSimplified(parsed.data);
      return NextResponse.json(result);
    }

    // Legacy full simulation mode
    const parsed = simuladorInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = simulate(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en simulador:", error);
    return NextResponse.json({ error: "Error al calcular" }, { status: 500 });
  }
}
