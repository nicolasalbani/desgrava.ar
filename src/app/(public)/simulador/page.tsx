import { SimuladorForm } from "@/components/simulador/simulador-form";

export default function SimuladorPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 sm:px-6 py-14">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Simulador de Deducciones</h1>
        <p className="text-muted-foreground">
          Calcula cuanto podes ahorrar en ganancias cargando tus deducciones en SiRADIG.
        </p>
      </div>
      <SimuladorForm />
    </div>
  );
}
