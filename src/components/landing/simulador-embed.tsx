import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SimuladorForm } from "@/components/simulador/simulador-form";
import { ArrowRight } from "lucide-react";

export function SimuladorEmbed() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Calcula cuanto podes recuperar
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Ingresa tu sueldo y tus gastos deducibles. Sin registro, sin compromiso.
        </p>
      </div>

      <SimuladorForm />

      <div className="mt-8 text-center">
        <Button size="lg" asChild>
          <Link href="/login">
            Registrate para desgravar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
