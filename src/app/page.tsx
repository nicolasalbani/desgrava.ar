import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesBento } from "@/components/landing/features-bento";
import { SimuladorEmbed } from "@/components/landing/simulador-embed";
import { PricingSection } from "@/components/landing/pricing-section";
import { ReviewsCarousel } from "@/components/landing/reviews-carousel";
import { FadeIn } from "@/components/landing/fade-in";

export default function LandingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="flex min-h-[calc(100vh-4rem)] items-center">
          <div className="mx-auto max-w-5xl space-y-6 px-4 py-16 text-center md:px-6 md:py-20">
            <FadeIn>
              <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Recupera la plata
                <br />
                <span className="text-primary">que ganancias te saca</span>
              </h1>
            </FadeIn>
            <FadeIn delay={150}>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
                Miles de pesos en deducciones se pierden cada año porque cargarlas en SiRADIG es un
                dolor de cabeza. desgrava.ar lo hace por vos.
              </p>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                <Button size="lg" asChild>
                  <a href="#simulador">
                    Calcula tu ahorro
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Empeza gratis</Link>
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Desgravá: How It Works + Features Bento ── */}
        <section
          id="desgrava"
          className="bg-muted/50 border-border flex min-h-screen flex-col justify-center border-t"
        >
          <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-16 md:px-6 md:py-20">
            <FadeIn>
              <HowItWorksSection />
            </FadeIn>
            <div className="border-border border-t pt-16">
              <FadeIn>
                <div className="mb-10 text-center">
                  <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                    Todo lo que necesitas para desgravar
                  </h2>
                  <p className="text-muted-foreground mt-2 text-base">
                    Automatizamos cada paso del proceso de deducciones
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={150}>
                <FeaturesBento />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── Simulador ── */}
        <section
          id="simulador"
          className="border-border flex min-h-screen flex-col justify-center border-t"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <FadeIn>
              <SimuladorEmbed />
            </FadeIn>
          </div>
        </section>

        {/* ── Planes: Pricing + Reviews ── */}
        <section
          id="planes"
          className="bg-muted/50 border-border flex min-h-screen flex-col justify-center border-t"
        >
          <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-16 md:px-6 md:py-20">
            <FadeIn>
              <PricingSection />
            </FadeIn>
            <div className="border-border border-t pt-16">
              <FadeIn>
                <div className="mb-10 text-center">
                  <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                    Lo que dicen nuestros usuarios
                  </h2>
                </div>
              </FadeIn>
              <FadeIn delay={150}>
                <ReviewsCarousel />
              </FadeIn>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
