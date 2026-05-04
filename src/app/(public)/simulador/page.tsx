import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SimuladorForm } from "@/components/simulador/simulador-form";
import { SimuladorFaq } from "@/components/landing/simulador-faq";
import { FISCAL_YEAR_DISPLAY } from "@/lib/simulador/tax-tables";

export const metadata: Metadata = {
  title: `Simulador Ganancias ${FISCAL_YEAR_DISPLAY} · Calculá tu devolución | desgrava.ar`,
  description: `Simulador gratuito del Impuesto a las Ganancias ${FISCAL_YEAR_DISPLAY}. Calculá cuánto podés recuperar con tus deducciones de F.572 / SiRADIG. Sin registro, sin tarjeta.`,
  keywords: [
    `simulador ganancias ${FISCAL_YEAR_DISPLAY}`,
    "deducciones ganancias",
    "F.572",
    "SiRADIG",
    "calculadora ganancias",
    "deducir alquiler ganancias",
    "ahorro impuesto ganancias",
  ],
  alternates: {
    canonical: "https://desgrava.ar/simulador",
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar/simulador",
    title: `Simulador Ganancias ${FISCAL_YEAR_DISPLAY} · desgrava.ar`,
    description: `Calculá cuánto podés recuperar de Ganancias ${FISCAL_YEAR_DISPLAY} cargando tus deducciones de F.572 / SiRADIG. Gratis, sin registro.`,
  },
};

export default function SimuladorPage() {
  return (
    <div className="bg-background overflow-x-hidden">
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-8 md:px-6 md:pt-16 md:pb-12">
          <header className="space-y-3 text-center md:text-left">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Simulador online · Gratis
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
              Simulador de Ganancias {FISCAL_YEAR_DISPLAY}
              <br className="hidden md:block" />
              <span className="text-primary"> Calculá cuánto podés recuperar</span>
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:mx-0">
              Movés los sliders con tus gastos mensuales — alquiler, prepaga, salud, educación,
              intereses hipotecarios, personal doméstico — y enterate al instante cuánto te
              correspondería recuperar de Ganancias en tu próxima liquidación de F.572 / SiRADIG.
              Sin registro, sin tarjeta, sin cargar facturas.
            </p>
          </header>
        </div>
      </section>

      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-16">
          <SimuladorForm />
        </div>
      </section>

      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            ¿Cómo funciona el cálculo?
          </h2>
          <div className="text-foreground space-y-5 text-base leading-relaxed">
            <p>
              El Impuesto a las Ganancias en Argentina se aplica por escalas: a mayor ganancia neta
              anual, mayor es la alícuota marginal — la última escala llega al 35%. Como las
              deducciones del F.572 reducen la base imponible, cada peso deducido te ahorra hasta
              <strong> 35 centavos</strong> de impuesto si estás en la escala más alta. Este
              simulador asume el 35% para mostrarte el ahorro máximo posible.
            </p>
            <p>
              Cargás tus gastos en la categoría correcta y el cálculo aplica los topes de ARCA en
              vigencia: el alquiler de vivienda es deducible al 40% con tope anual, los gastos
              médicos al 40% con tope del 5% de la ganancia neta, la prepaga al 100% con el mismo
              tope, el personal doméstico y los gastos educativos tienen topes anuales fijos. La
              herramienta toma estas reglas y te muestra cuánto sería deducible y cuánto sería el
              ahorro de impuesto.
            </p>
            <p>
              El F.572 Web (también llamado SiRADIG) es la declaración jurada online de ARCA que
              permite a los empleados en relación de dependencia informar sus deducciones a su
              empleador para que se las computen al retener Ganancias del sueldo. Si nunca lo
              presentaste, estás dejando plata sobre la mesa todos los meses.
            </p>
            <p>
              desgrava.ar automatiza la carga del F.572: detecta tus facturas, las clasifica por
              categoría con IA, y las presenta en SiRADIG por vos. Probá 30 días gratis sin tarjeta.
            </p>
          </div>
        </div>
      </section>

      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <SimuladorFaq />
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 text-center md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            Empezá a recuperar lo que es tuyo
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-base">
            Conectá tu cuenta de ARCA y dejá que desgrava.ar cargue tus deducciones automáticamente
            en SiRADIG. Probá 30 días gratis.
          </p>
          <div className="flex justify-center pt-2">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/login">
                Probá 30 días gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            ✓ 30 días gratis · ✓ Sin tarjeta · ✓ Cancelás cuando quieras
          </p>
        </div>
      </section>
    </div>
  );
}
