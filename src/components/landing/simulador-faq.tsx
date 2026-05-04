import Script from "next/script";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "¿Qué gastos puedo deducir de Ganancias en 2026?",
    a: "Los principales conceptos deducibles son: alquiler de vivienda (40% del monto, con tope anual), prepaga, gastos médicos y paramédicos, gastos educativos, intereses de crédito hipotecario, personal doméstico, donaciones, primas de seguro y aportes a planes de retiro privados. Cada uno tiene reglas y topes específicos definidos por ARCA.",
  },
  {
    q: "¿Cuánto se puede deducir por alquiler?",
    a: "Si alquilás tu vivienda, podés deducir el 40% del monto pagado durante el año, con un tope anual. El tope para 2025 es de $3.091.035. Necesitás que el contrato esté a tu nombre y registrado en ARCA.",
  },
  {
    q: "¿La prepaga es deducible?",
    a: "Sí. Las cuotas de medicina prepaga son 100% deducibles, con un tope global del 5% de tu ganancia neta anual (sumado al resto de gastos médicos).",
  },
  {
    q: "¿El servicio doméstico se puede deducir?",
    a: "Sí. Podés deducir lo pagado a tu personal doméstico declarado, con tope anual de $3.091.035 para 2025. Tenés que tener al trabajador inscripto en ARCA y los recibos al día.",
  },
  {
    q: "¿Cómo se presenta el F.572?",
    a: "El F.572 Web (también llamado SiRADIG) se presenta online desde el sitio de ARCA con tu CUIT y clave fiscal. Cargás tus deducciones mes a mes y tu empleador las aplica al calcular el impuesto que te retiene del sueldo.",
  },
  {
    q: "¿Hasta cuándo tengo tiempo para presentar el SiRADIG?",
    a: "La declaración jurada anual del SiRADIG vence el 31 de marzo del año siguiente al período fiscal. Por ejemplo, las deducciones del año 2026 tenés tiempo de presentarlas hasta el 31 de marzo de 2027.",
  },
  {
    q: "¿Necesito guardar las facturas?",
    a: "Sí. ARCA puede pedirte la documentación respaldatoria de cada deducción durante un período de hasta 5 años. Guardá las facturas tipo B o C a tu nombre y los recibos correspondientes.",
  },
  {
    q: "¿Cuánto cuesta usar desgrava.ar?",
    a: "El plan Personal cuesta $5.999 por mes. Tenés 30 días gratis sin tarjeta y podés cancelar cuando quieras. La plataforma se paga sola con la primera devolución de impuestos.",
  },
];

function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
  return (
    <Script
      id="simulador-faq-jsonld"
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SimuladorFaq() {
  return (
    <section className="space-y-4">
      <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
        Preguntas frecuentes
      </h2>
      <div className="border-border divide-border bg-card divide-y rounded-2xl border">
        {FAQS.map((item, i) => (
          <details key={i} className="group p-4 sm:p-5">
            <summary className="text-foreground flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
      <FaqJsonLd />
    </section>
  );
}
