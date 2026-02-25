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
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className="relative py-20 md:py-24"
          style={{
            background:
              "radial-gradient(ellipse at center, #eff6ff 0%, #ffffff 70%)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-8 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Automatiza tus deducciones
              <br />
              <span className="text-primary">en SiRADIG</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Deja de perder plata. Carga tus facturas, calcula tu ahorro y
              automatiza la carga en SiRADIG con un click.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="shadow-md transition-all duration-150 hover:brightness-90">
                <Link href="/simulador">
                  Simular ahorro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="transition-all duration-150 hover:bg-gray-100">
                <Link href="/login">Empezar a desgravar</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-2">Todo lo que necesitas</h2>
              <p className="text-gray-500">
                Carga tus deducciones y ahorra en minutos.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-500">
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
