import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Bot, Calculator, Shield, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ReviewsCarousel } from "@/components/landing/reviews-carousel";

const features = [
  {
    icon: Calculator,
    title: "Sabe cuanto vas a ahorrar",
    description:
      "Simula tu devolucion de ganancias antes de cargar nada. Sin registro.",
  },
  {
    icon: FileText,
    title: "Subi tus facturas y listo",
    description:
      "Arrastra un PDF o carga los datos a mano. Nuestro OCR extrae todo en segundos.",
  },
  {
    icon: Bot,
    title: "SiRADIG en un click",
    description:
      "Conecta tu clave fiscal y dejanos cargar tus deducciones automaticamente.",
  },
  {
    icon: Shield,
    title: "Tu clave fiscal, protegida",
    description:
      "Encriptacion AES-256 de grado bancario. Nunca se almacena en texto plano.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Recupera la plata
              <br />
              <span className="text-primary">que ganancias te saca</span>
            </h1>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              Miles de pesos en deducciones se pierden cada ano porque cargarlas
              en SiRADIG es un dolor de cabeza. desgrava.ar lo hace por vos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild>
                <Link href="/simulador">
                  Calcula tu ahorro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Empeza gratis</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-14 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
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

        {/* Reviews */}
        <section className="py-14 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <ReviewsCarousel />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
