import { SimuladorForm } from "@/components/simulador/simulador-form";

export default function SimuladorPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Simulador de Deducciones</h1>
        <p className="text-muted-foreground">
          Calcula cuanto podes ahorrar en ganancias cargando tus deducciones en SiRADIG.
        </p>
      </div>
      <SimuladorForm />
    </div>
  );
}
