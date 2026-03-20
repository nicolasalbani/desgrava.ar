interface Step {
  number: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Simula tu ahorro",
    description:
      "Ingresa tu sueldo bruto y tus gastos deducibles. En segundos ves cuanto podes recuperar.",
  },
  {
    number: 2,
    title: "Carga tus facturas",
    description:
      "Subi un PDF, cargalas a mano o importalas directo desde ARCA. La IA clasifica la categoria por vos.",
  },
  {
    number: 3,
    title: "Enviamos a SiRADIG",
    description:
      "Conecta tu clave fiscal y con un click cargamos todas tus deducciones en SiRADIG automaticamente.",
  },
];

export function HowItWorksSection() {
  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Como funciona
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Tres pasos para recuperar lo que es tuyo
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center">
            <div className="bg-primary text-primary-foreground mb-4 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold">
              {step.number}
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">{step.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
