import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesBento } from "@/components/landing/features-bento";
import { LandingFaq } from "@/components/landing/landing-faq";

export const metadata: Metadata = {
  title: "Cómo funciona desgrava.ar · Automatizá tus deducciones de Ganancias",
  description:
    "Conectás tu CUIT, importamos tus comprobantes desde ARCA, los clasifica nuestra IA y presentamos tu F.572 / SiRADIG por vos — todos los meses.",
  keywords: [
    "como funciona desgrava",
    "automatizar SiRADIG",
    "F.572 paso a paso",
    "deducciones Ganancias automatico",
    "ARCA SiRADIG",
  ],
  alternates: {
    canonical: "https://desgrava.ar/como-funciona",
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar/como-funciona",
    title: "Cómo funciona desgrava.ar",
    description:
      "Conectás tu CUIT, importamos tus comprobantes desde ARCA, los clasifica nuestra IA y presentamos tu F.572 / SiRADIG por vos — todos los meses.",
  },
};

export default function ComoFuncionaPage() {
  return (
    <div className="bg-background overflow-x-hidden">
      {/* Hero */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-8 md:px-6 md:pt-16 md:pb-12">
          <header className="space-y-3 text-center md:text-left">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Producto · Automatización ARCA
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
              Cómo funciona desgrava.ar
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:mx-0">
              desgrava.ar conecta con tu cuenta de ARCA, importa tus comprobantes, los clasifica con
              IA en categorías deducibles y presenta tu F.572 / SiRADIG todos los meses — sin que
              tengas que entrar al portal ni recordar cuándo vencen las deducciones. Diseñado para
              empleados en relación de dependencia que quieren recuperar lo que les retiene
              Ganancias sin pagar honorarios mensuales a un contador.
            </p>
            <div className="flex flex-col justify-center gap-3 pt-3 sm:flex-row md:justify-start">
              <Button asChild size="lg" className="h-12 text-base">
                <Link href="/login">
                  Probá 30 días gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 text-base">
                <Link href="/planes">Ver planes</Link>
              </Button>
            </div>
          </header>
        </div>
      </section>

      {/* Tres pasos */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-16">
          <HowItWorksSection />
        </div>
      </section>

      {/* Todo lo que necesitas */}
      <section className="bg-muted/50 border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-10 text-center">
            <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
              Todo lo que necesitas
            </h2>
            <p className="text-muted-foreground mt-2 text-base">
              Todo lo que necesitas para desgravar, en un solo lugar.
            </p>
          </div>
          <FeaturesBento />
        </div>
      </section>

      {/* Expanded SEO copy */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            ¿Cómo se automatiza la presentación de deducciones?
          </h2>
          <div className="text-foreground space-y-5 text-base leading-relaxed">
            <p>
              El F.572 Web — también conocido como SiRADIG — es la declaración jurada online de ARCA
              donde los empleados en relación de dependencia informan sus deducciones a su empleador
              para que se las computen al retener Impuesto a las Ganancias del sueldo. Si no lo
              presentás, tu empleador retiene el máximo posible y dejás plata sobre la mesa todos
              los meses. Si lo presentás una vez al año en marzo, recuperás solo en la liquidación
              anual; si lo actualizás mes a mes, la diferencia aparece en cada recibo de sueldo.
              desgrava.ar automatiza esa carga mensual.
            </p>
            <p>
              Cuando creás tu cuenta, te pedimos tu CUIT y clave fiscal de ARCA una sola vez. Las
              guardamos cifradas con AES-256-GCM y solo las descifrámos en el momento exacto en que
              un trabajo de automatización las necesita — nunca quedan en memoria, nunca se imprimen
              en logs, nunca se comparten. Con esas credenciales un browser headless inicia sesión
              en ARCA por vos, importa tus comprobantes recibidos, tus empleadores, tus cargas de
              familia y tus datos personales del último período fiscal. Todo en cuestión de minutos.
            </p>
            <p>
              Cada comprobante se procesa por OCR (texto del PDF cuando está disponible, Tesseract
              como fallback para escaneos) y se clasifica con IA en una de las categorías
              deducibles: alquiler de vivienda, prepaga, gastos médicos, educación, intereses
              hipotecarios, personal doméstico. Si subís un PDF manual, el mismo pipeline detecta
              proveedor, monto, fecha y categoría sugerida. Las facturas claramente no deducibles
              (supermercados, servicios públicos) se marcan automáticamente y quedan fuera del
              cálculo, sin que tengas que revisarlas una por una.
            </p>
            <p>
              Una vez clasificados los comprobantes, presionás &ldquo;Desgravar&rdquo; y desgrava.ar
              abre SiRADIG por vos: navega los formularios, carga cada deducción en su categoría
              correcta, respeta los topes de ARCA (40% del alquiler, 5% de la ganancia neta para
              gastos médicos, topes anuales para personal doméstico y educación) y guarda la
              presentación. Cada factura es un trabajo independiente — si una falla, las que ya se
              presentaron quedan firmes y la fallida la podés re-enviar con un click. El ciclo se
              cierra cuando tu empleador toma el SiRADIG actualizado en la próxima liquidación: te
              retiene menos Ganancias y la diferencia se ve directo en el recibo de sueldo.
            </p>
            <p>
              ¿En qué se diferencia de un contador? Un contador típicamente carga tus deducciones
              una vez al año en marzo y te cobra honorarios por la atención. desgrava.ar es
              software: presenta el F.572 todos los meses, sin sobrecostos por trámite, sin tener
              que mandar fotos de las facturas por mail y sin compartir tu clave fiscal por un canal
              inseguro. El asesoramiento contable puntual sigue valiendo la pena — el trámite
              mensual repetitivo, no.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <LandingFaq />
        </div>
      </section>

      {/* CTA final */}
      <section>
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 text-center md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            Empezá a recuperar lo que es tuyo
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-base">
            Conectá tu cuenta de ARCA y dejá que desgrava.ar cargue tus deducciones automáticamente
            en SiRADIG. Probá 30 días gratis, sin tarjeta.
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
