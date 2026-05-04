import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, Lock, Zap, MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { LandingFooter } from "@/components/layout/landing-footer";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesBento } from "@/components/landing/features-bento";
import { SimuladorEmbed } from "@/components/landing/simulador-embed";
import { PricingSection } from "@/components/landing/pricing-section";
import { ReviewsCarousel } from "@/components/landing/reviews-carousel";
import { FadeIn } from "@/components/landing/fade-in";

export default function LandingPage() {
  // F.572 deadline is March 31st each year — surface an urgency line during
  // the Jan–Mar cutoff window. Server-rendered, no hydration flash.
  const isF572CutoffWindow = new Date().getMonth() <= 2;

  return (
    <div className="bg-background flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero + Reviews ── */}
        <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center">
          <div className="mx-auto max-w-5xl space-y-6 px-4 pt-12 text-center md:px-6 md:pt-16">
            <FadeIn>
              <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Recuperá la plata
                <br />
                <span className="text-primary">que Ganancias te saca</span>
              </h1>
            </FadeIn>
            <FadeIn delay={150}>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
                Deducimos tus alquileres, gastos médicos, educación y personal doméstico en ARCA por
                vos. En minutos. Más fácil, más rápido, sin errores.
              </p>
            </FadeIn>
            {isF572CutoffWindow && (
              <FadeIn delay={225}>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  ⏳ El F.572 vence el 31 de marzo. Falta poco.
                </p>
              </FadeIn>
            )}
            <FadeIn delay={300}>
              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                <Button size="lg" variant="outline" asChild>
                  <Link href="/simulador">Calculá tu ahorro</Link>
                </Button>
                <Button size="lg" asChild>
                  <Link href="/login">
                    Probá 30 días gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-muted-foreground mt-3 text-center text-xs">
                Sin tarjeta de crédito · Cancelás cuando quieras
              </p>
            </FadeIn>
            <FadeIn delay={375}>
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-y-2 text-xs sm:flex-row sm:gap-x-6">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Datos cifrados
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  Listo en 10 minutos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Hecho en Argentina
                </span>
              </div>
            </FadeIn>
          </div>
          <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-8 md:px-6 md:pt-14 md:pb-12">
            <FadeIn delay={450}>
              <ReviewsCarousel />
            </FadeIn>
          </div>
          <FadeIn delay={600}>
            <a
              href="#desgrava"
              className="text-muted-foreground hover:text-foreground mx-auto mb-6 flex flex-col items-center gap-1 text-sm transition-colors"
            >
              <span>Conoce cómo funciona</span>
              <ChevronDown className="h-5 w-5 animate-bounce" />
            </a>
          </FadeIn>
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
                    Todo lo que necesitas
                  </h2>
                  <p className="text-muted-foreground mt-2 text-base">
                    Todo lo que necesitas para desgravar, en un solo lugar.
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
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
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
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
