import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";
import { PricingFaq } from "@/components/landing/pricing-faq";
import { TRIAL_DURATION_DAYS, getAnnualDiscountPercent } from "@/lib/subscription/plans";

export const metadata: Metadata = {
  title: "Planes y precios · desgrava.ar",
  description: `${TRIAL_DURATION_DAYS} días gratis sin tarjeta. Suscripción mensual o anual con descuento. Pagás en pesos a través de MercadoPago. Cancelás cuando quieras.`,
  keywords: [
    "precios desgrava",
    "planes desgrava",
    "cuanto cuesta desgrava",
    "suscripcion desgrava",
    "F.572 precio",
  ],
  alternates: {
    canonical: "https://desgrava.ar/planes",
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar/planes",
    title: "Planes y precios · desgrava.ar",
    description: `${TRIAL_DURATION_DAYS} días gratis sin tarjeta. Suscripción mensual o anual con descuento. Pagás en pesos a través de MercadoPago. Cancelás cuando quieras.`,
  },
};

export default function PlanesPage() {
  const annualDiscountPct = getAnnualDiscountPercent();

  return (
    <div className="bg-background overflow-x-hidden">
      {/* Hero */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-8 md:px-6 md:pt-16 md:pb-12">
          <header className="space-y-3 text-center md:text-left">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Suscripción mensual o anual
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
              Planes y precios
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:mx-0">
              Probá desgrava.ar gratis durante {TRIAL_DURATION_DAYS} días sin tarjeta. Si te
              convence, elegís plan mensual o anual con descuento — todo facturado en pesos a través
              de MercadoPago, cancelable desde tu panel cuando quieras.
            </p>
          </header>
        </div>
      </section>

      {/* Tarifas */}
      <section className="bg-muted/50 border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-16">
          <PricingSection />
        </div>
      </section>

      {/* Expanded SEO copy */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            Cómo funciona la suscripción
          </h2>
          <div className="text-foreground space-y-5 text-base leading-relaxed">
            <p>
              Cuando creás tu cuenta arrancás con {TRIAL_DURATION_DAYS} días de prueba gratis sin
              tarjeta de crédito. Durante el trial tenés acceso completo a todo lo que incluye el
              plan Personal: simulador, carga manual o por OCR de comprobantes, importación desde
              ARCA, clasificación con IA, gestión de personal doméstico y presentación automática a
              SiRADIG. No te pedimos un medio de pago para empezar — solo te lo pedimos si decidís
              continuar al final del trial.
            </p>
            <p>
              El plan mensual se factura mes a mes y se renueva automáticamente; el plan anual se
              factura en un solo cargo por todo el año con un descuento del {annualDiscountPct}%
              sobre el precio mensual equivalente. En ambos casos cobramos a través de MercadoPago,
              así que aceptamos tarjetas de crédito, débito y dinero en cuenta — los mismos medios
              que usás todos los días en Argentina. Podés cambiar entre mensual y anual en cualquier
              momento desde tu configuración: el cambio se aplica en la próxima renovación, sin
              prorrateos confusos.
            </p>
            <p>
              Cancelás desde /configuracion con un click. La cancelación detiene la próxima
              renovación pero el período corriente sigue activo hasta el final, así que no perdés lo
              que ya pagaste. Si dejás vencer la suscripción, la cuenta entra en modo solo lectura:
              podés seguir consultando tus comprobantes y presentaciones, pero no cargar nuevas ni
              presentar a SiRADIG. Tus datos no se borran automáticamente — si querés, los borrás
              vos mismo desde el panel.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <PricingFaq />
        </div>
      </section>

      {/* CTA final */}
      <section>
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 text-center md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            Empezá hoy, pagá cuando estés convencido
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-base">
            {TRIAL_DURATION_DAYS} días gratis sin tarjeta. Si no te convence, no se cobra nada.
          </p>
          <div className="flex justify-center pt-2">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/login">
                Probá {TRIAL_DURATION_DAYS} días gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            ✓ {TRIAL_DURATION_DAYS} días gratis · ✓ Sin tarjeta · ✓ Cancelás cuando quieras
          </p>
        </div>
      </section>
    </div>
  );
}
