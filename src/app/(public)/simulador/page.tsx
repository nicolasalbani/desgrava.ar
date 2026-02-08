import { SimuladorForm } from "@/components/simulador/simulador-form";

export default function SimuladorPage() {
  return (
    <div className="container py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Simulador de Deducciones</h1>
        <p className="text-muted-foreground">
          Calcula cuanto podes ahorrar en ganancias cargando tus deducciones en SiRADIG.
        </p>
      </div>
      <SimuladorForm />
    </div>
  );
}
