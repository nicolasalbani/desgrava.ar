import { SimuladorForm } from "@/components/simulador/simulador-form";

export function SimuladorEmbed() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Calcula cuanto podes recuperar
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Carga tus gastos deducibles y enterate cuanto podes ahorrar. Sin registro, sin compromiso.
        </p>
      </div>

      <SimuladorForm />
    </div>
  );
}
