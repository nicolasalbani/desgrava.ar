import type { Metadata } from "next";

const LAST_UPDATED = "2026-05-01";

export const metadata: Metadata = {
  title: "Términos y condiciones · desgrava.ar",
  description:
    "Términos y condiciones de uso del servicio desgrava.ar para contribuyentes argentinos.",
};

export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10">
        <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
          Términos y condiciones
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Última actualización: {LAST_UPDATED}</p>
      </header>

      <div className="text-foreground space-y-8 text-base leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">1. Sobre desgrava.ar</h2>
          <p>
            desgrava.ar es una plataforma que ayuda a contribuyentes argentinos a calcular su ahorro
            fiscal y a cargar deducciones del Impuesto a las Ganancias en el formulario F.572 web
            (SiRADIG) de ARCA/AFIP. desgrava.ar no tiene afiliación, vínculo comercial ni respaldo
            oficial de ARCA, AFIP ni ninguna entidad gubernamental.
          </p>
          <p>
            Al usar el servicio aceptás estos términos. Si no estás de acuerdo con alguna parte, no
            podés utilizar la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">2. Cuenta y registro</h2>
          <p>
            Para usar desgrava.ar tenés que crear una cuenta con un email válido. Sos responsable de
            mantener la confidencialidad de tus credenciales y de toda la actividad que ocurra bajo
            tu cuenta. Si detectás un uso no autorizado, avisanos lo antes posible.
          </p>
          <p>
            Las credenciales de ARCA que cargues en la plataforma se almacenan cifradas con
            AES-256-GCM y solo se descifran en el momento de ejecutar una automatización en tu
            nombre.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">3. Planes y pagos</h2>
          <p>
            Ofrecemos un período de prueba gratuito de 30 días. Al finalizar el trial, para seguir
            usando el servicio necesitás contratar una suscripción mensual o anual. Los pagos se
            procesan a través de MercadoPago bajo el esquema de Suscripciones (Preapproval).
          </p>
          <p>
            Podés cancelar tu suscripción en cualquier momento desde la sección de configuración o
            desde MercadoPago. Las cancelaciones tienen efecto al final del período pago en curso;
            no se realizan reembolsos prorrateados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">4. Uso aceptable</h2>
          <p>
            Te comprometés a usar desgrava.ar únicamente con tus propios datos fiscales o con datos
            de terceros que te hayan autorizado expresamente. No podés usar la plataforma para fines
            ilegales, para evadir impuestos, ni para acceder a cuentas de ARCA que no te
            pertenezcan.
          </p>
          <p>
            Tampoco podés intentar reproducir, copiar, vender o explotar comercialmente la
            plataforma sin autorización escrita.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">5. Propiedad intelectual</h2>
          <p>
            El software, la marca, el diseño y los contenidos de desgrava.ar son propiedad de sus
            titulares. La cuenta que creás te otorga una licencia personal, limitada y no
            transferible para usar el servicio mientras tu suscripción esté vigente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">
            6. Limitación de responsabilidad
          </h2>
          <p>
            desgrava.ar es una herramienta de asistencia. La responsabilidad final de la declaración
            fiscal, de la veracidad de los datos cargados y del cumplimiento de las obligaciones
            tributarias es exclusivamente tuya. Te recomendamos revisar siempre las cargas antes de
            presentarlas en SiRADIG y, ante dudas complejas, consultar a un contador matriculado.
          </p>
          <p>
            Hacemos esfuerzos razonables para mantener la plataforma operativa y los cálculos
            actualizados según la normativa vigente, pero no garantizamos disponibilidad
            ininterrumpida ni resultados específicos. En la medida máxima permitida por la ley, no
            seremos responsables por daños indirectos, lucro cesante o multas derivadas del uso del
            servicio.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">7. Terminación</h2>
          <p>
            Podés cerrar tu cuenta en cualquier momento. Nosotros podemos suspender o terminar el
            acceso si detectamos uso indebido, falta de pago o violación de estos términos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">8. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia
            será sometida a los tribunales ordinarios competentes de la Ciudad Autónoma de Buenos
            Aires.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">9. Contacto</h2>
          <p>
            Si tenés consultas sobre estos términos podés escribirnos al email de soporte o por
            WhatsApp desde la sección de contacto del sitio.
          </p>
        </section>
      </div>
    </article>
  );
}
