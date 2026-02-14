import { SimuladorForm } from "@/components/simulador/simulador-form";

export default function SimuladorPage() {
  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-[800px] px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Simulador de Deducciones</h1>
        <p className="text-gray-500 text-base">
          Calcula cuanto podes ahorrar en ganancias cargando tus deducciones en SiRADIG.
        </p>
      </div>
      <SimuladorForm />
    </div>
  );
}
