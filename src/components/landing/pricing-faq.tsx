import { FaqAccordion, type FaqItem } from "./faq-accordion";

const PRICING_FAQ_ITEMS: FaqItem[] = [
  {
    q: "¿Cuánto dura la prueba gratuita?",
    a: "30 días, con acceso completo a todo lo que incluye el plan Personal — carga de comprobantes, importación desde ARCA, presentación a SiRADIG, simulador. No te pedimos tarjeta de crédito para empezar.",
  },
  {
    q: "¿Necesito tarjeta de crédito para registrarme?",
    a: "No. La prueba se activa solo con tu cuenta de Google o tu email + contraseña. Si al final de los 30 días querés continuar, te pedimos un medio de pago a través de MercadoPago.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Cancelás desde /configuracion con un click. La cancelación detiene la próxima renovación; el período corriente sigue activo hasta el final, así no perdés lo que ya pagaste.",
  },
  {
    q: "¿Hay descuento por pago anual?",
    a: "Sí. El plan anual aplica un descuento sobre el precio mensual (el porcentaje exacto se ve arriba con el toggle Mensual/Anual). Pagás un solo cargo por todo el año a través de MercadoPago.",
  },
  {
    q: "¿Qué métodos de pago aceptan?",
    a: "Cobramos a través de MercadoPago, así que aceptamos tarjetas de crédito, débito y dinero en cuenta de MercadoPago — los mismos medios que usás todos los días en Argentina.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo o si vence la suscripción?",
    a: "La cuenta entra en modo de solo lectura: podés seguir consultando tus comprobantes y deducciones, pero no podés cargar nuevas ni presentar a SiRADIG. Tus datos no se borran automáticamente — si querés borrarlos, lo hacés vos desde el panel.",
  },
  {
    q: "¿Puedo cambiar entre plan mensual y anual?",
    a: "Sí. Al cambiar de mensual a anual, el cambio se aplica en la próxima renovación con el precio anual con descuento. Para volver de anual a mensual, esperás al final del ciclo anual ya pagado.",
  },
];

export function PricingFaq() {
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Preguntas frecuentes sobre planes
        </h2>
        <p className="text-muted-foreground mt-2 text-base">Trial, facturación y cancelación.</p>
      </div>
      <div className="pt-4">
        <FaqAccordion items={PRICING_FAQ_ITEMS} jsonLdId="planes-faq-jsonld" />
      </div>
    </section>
  );
}
