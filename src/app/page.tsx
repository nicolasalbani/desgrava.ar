import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Bot, Calculator, Shield, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

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
      "Calcula cuanto podes ahorrar en ganancias segun tus deducciones. Sin registro.",
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
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 md:py-32">
          <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Automatiza tus deducciones
              <br />
              <span className="text-primary">en SiRADIG</span>
            </h1>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              Deja de perder plata. Carga tus facturas, calcula tu ahorro y
              automatiza la carga en SiRADIG con un click.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" asChild>
                <Link href="/simulador">
                  Simular ahorro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Empezar a desgravar</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-20 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Todo lo que necesitas
              </h2>
              <p className="text-gray-500 mt-2">
                Carga tus deducciones y ahorra en minutos.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <h3 className="font-medium text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
