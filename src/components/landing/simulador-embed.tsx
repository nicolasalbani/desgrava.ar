import Link from "next/link";
import { SimuladorForm } from "@/components/simulador/simulador-form";

export function SimuladorEmbed() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Calculá cuánto podés recuperar
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Movés los sliders y enterate al instante. Sin registro, sin compromiso.
        </p>
      </div>

      <SimuladorForm />

      <p className="text-muted-foreground mt-8 text-center text-xs">
        ¿Querés más detalles?{" "}
        <Link href="/simulador" className="text-primary underline-offset-2 hover:underline">
          Mirá el simulador completo con preguntas frecuentes
        </Link>
      </p>
    </div>
  );
}
