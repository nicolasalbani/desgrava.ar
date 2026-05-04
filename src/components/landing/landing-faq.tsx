import { FaqAccordion, type FaqItem } from "./faq-accordion";

const LANDING_FAQ_ITEMS: FaqItem[] = [
  {
    q: "¿Cómo manejan mis credenciales de ARCA? ¿Es seguro?",
    a: "Tu CUIT y clave fiscal se cifran con AES-256-GCM antes de guardarse. Solo se descifran en el momento exacto en que un trabajo de automatización las necesita y nunca quedan en memoria. Tu clave nunca se imprime en logs ni se comparte con terceros — la usamos exclusivamente para iniciar sesión en ARCA por vos.",
  },
  {
    q: "¿Sirve si soy monotributista o autónomo?",
    a: "Por ahora no del todo. desgrava.ar está pensado para empleados en relación de dependencia que tienen que presentar el F.572 web (SiRADIG) — no liquidamos el F.711 ni Ganancias 4ta categoría. Si combinás un trabajo en relación de dependencia con monotributo, sí: igual cargamos las deducciones del F.572 que correspondan a ese trabajo.",
  },
  {
    q: "¿Mi empleador o ARCA pueden ver que uso desgrava.ar?",
    a: 'No. Todo lo que cargamos en SiRADIG se carga "desde tu CUIT" — para ARCA es indistinguible de una carga manual hecha por vos. Tu empleador solo ve las deducciones presentadas en el SiRADIG, no el medio por el que llegaron ahí.',
  },
  {
    q: "¿Cuándo voy a ver la plata?",
    a: 'No es una "devolución" como un reintegro de un solo pago: tus deducciones reducen la retención mensual de Ganancias en tu próximo recibo de sueldo. Cuando tu empleador toma el SiRADIG actualizado (típicamente en la liquidación del mes siguiente al que cargaste), aplica los nuevos topes y te retiene menos. La diferencia se ve directo en el bolsillo, mes a mes.',
  },
  {
    q: "¿Qué pasa si después de los 30 días gratis no quiero seguir?",
    a: "No se cobra nada — la prueba es sin tarjeta de crédito. Solo te pedimos un medio de pago si elegís continuar al final del trial. Podés cancelar la suscripción cuando quieras desde /configuracion y los datos los borrás vos mismo desde el panel.",
  },
  {
    q: "¿En qué se diferencia de un contador?",
    a: "Un contador es una persona que típicamente carga tus deducciones una vez al año, en marzo, y te cobra honorarios por la atención. desgrava.ar es software: presenta el F.572 todos los meses, sin sobrecostos por trámite, sin esperar respuesta de mail y sin pedirte que compartas tu clave fiscal por un canal inseguro. Si querés además asesoramiento contable puntual, el contador no se reemplaza — pero el trámite mensual del F.572 sí.",
  },
  {
    q: "¿Qué pasa si SiRADIG falla en medio de la presentación?",
    a: "Cada factura que enviás se procesa como un trabajo de automatización individual e independiente. Si una falla, las que ya se cargaron quedan firmes en SiRADIG y vos ves el estado factura por factura en el panel. La fallida la podés re-enviar con un click cuando quieras, sin tocar las que ya se presentaron.",
  },
];

export function LandingFaq() {
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Preguntas frecuentes
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Las dudas más comunes antes de empezar.
        </p>
      </div>
      <div className="pt-4">
        <FaqAccordion items={LANDING_FAQ_ITEMS} jsonLdId="landing-faq-jsonld" />
      </div>
    </section>
  );
}
