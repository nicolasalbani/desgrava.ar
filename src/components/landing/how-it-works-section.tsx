import Image from "next/image";

interface Step {
  number: number;
  title: string;
  description: string;
  imageLight: string;
  imageDark: string;
  alt: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Crea tu cuenta",
    description: "Crea tu cuenta e ingresa tu clave fiscal.",
    imageLight: "/images/landing/steps/step-1-credenciales-light.png",
    imageDark: "/images/landing/steps/step-1-credenciales-dark.png",
    alt: "Pantalla de conexión con ARCA en desgrava.ar",
  },
  {
    number: 2,
    title: "Carga tus gastos",
    description: "Importa tus gastos desde ARCA o cargalos en la app en minutos.",
    imageLight: "/images/landing/steps/step-2-comprobantes-light.png",
    imageDark: "/images/landing/steps/step-2-comprobantes-dark.png",
    alt: "Listado de comprobantes importados desde ARCA en desgrava.ar",
  },
  {
    number: 3,
    title: "Desgravá",
    description: "Presentá tus deducciones con un click.",
    imageLight: "/images/landing/steps/step-3-presentaciones-light.png",
    imageDark: "/images/landing/steps/step-3-presentaciones-dark.png",
    alt: "Pantalla de presentaciones de SiRADIG completadas en desgrava.ar",
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

      <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center">
            <div className="border-border bg-muted relative mb-6 aspect-[16/10] w-full overflow-hidden rounded-xl border shadow-sm">
              <Image
                src={step.imageLight}
                alt={step.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-contain dark:hidden"
              />
              <Image
                src={step.imageDark}
                alt={step.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="hidden object-contain dark:block"
              />
            </div>
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
