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
    description: "Simula tu devolucion de ganancias antes de cargar nada. Sin registro.",
  },
  {
    icon: FileText,
    title: "Subi tus facturas y listo",
    description: "Arrastra un PDF o carga los datos a mano. Nuestro OCR extrae todo en segundos.",
  },
  {
    icon: Bot,
    title: "SiRADIG en un click",
    description: "Conecta tu clave fiscal y dejanos cargar tus deducciones automaticamente.",
  },
  {
    icon: Shield,
    title: "Tu clave fiscal, protegida",
    description: "Encriptacion AES-256 de grado bancario. Nunca se almacena en texto plano.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-5xl space-y-6 px-4 text-center md:px-6">
            <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl">
              Recupera la plata
              <br />
              <span className="text-primary">que ganancias te saca</span>
            </h1>
            <p className="text-muted-foreground mx-auto max-w-xl text-base leading-relaxed">
              Miles de pesos en deducciones se pierden cada ano porque cargarlas en SiRADIG es un
              dolor de cabeza. desgrava.ar lo hace por vos.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
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
        <section className="bg-muted/50 border-border border-t py-14">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="space-y-3">
                    <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                      <Icon className="text-muted-foreground h-5 w-5" />
                    </div>
                    <h3 className="text-foreground font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="border-border border-t py-14">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <ReviewsCarousel />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
