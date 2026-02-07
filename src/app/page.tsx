import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calculator, FileText, Bot, Shield, ArrowRight } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Carga de facturas",
    description:
      "Subi tus facturas en PDF o cargalas manualmente. El OCR extrae los datos automaticamente.",
  },
  {
    icon: Bot,
    title: "Automatizacion SiRADIG",
    description:
      "Conecta tu clave fiscal y desgrava.ar carga tus deducciones en SiRADIG por vos.",
  },
  {
    icon: Calculator,
    title: "Simulador de ahorro",
    description:
      "Calcula cuanto podes ahorrar en ganancias segun tus deducciones. Gratis y sin registro.",
  },
  {
    icon: Shield,
    title: "Seguridad",
    description:
      "Tu clave fiscal se encripta con AES-256. Nunca se almacena en texto plano.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Calculator className="h-6 w-6" />
            desgrava.ar
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/simulador"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Simulador
            </Link>
            <Button asChild>
              <Link href="/login">Iniciar sesion</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24 md:py-32 space-y-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Automatiza tus deducciones
            <br />
            <span className="text-muted-foreground">en SiRADIG</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Deja de perder plata. Carga tus facturas, calcula tu ahorro y
            automatiza la carga en SiRADIG con un click.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/simulador">
                Simular ahorro gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Empezar a desgravar</Link>
            </Button>
          </div>
        </section>

        <section className="container py-16 border-t">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="space-y-3">
                  <Icon className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="h-4 w-4" />
            desgrava.ar
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date().getFullYear()} desgrava.ar. No afiliado a ARCA/AFIP.
          </p>
        </div>
      </footer>
    </div>
  );
}
