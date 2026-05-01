import type { Metadata } from "next";

const LAST_UPDATED = "2026-05-01";

export const metadata: Metadata = {
  title: "Política de privacidad · desgrava.ar",
  description:
    "Cómo desgrava.ar recolecta, usa, almacena y protege los datos personales de sus usuarios.",
};

export default function PrivacidadPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10">
        <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
          Política de privacidad
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Última actualización: {LAST_UPDATED}</p>
      </header>

      <div className="text-foreground space-y-8 text-base leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">1. Quiénes somos</h2>
          <p>
            desgrava.ar es responsable del tratamiento de los datos personales que recolectamos a
            través de la plataforma. Esta política se rige por la Ley 25.326 de Protección de los
            Datos Personales de la República Argentina.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">2. Qué datos recolectamos</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Datos de cuenta</strong>: email, nombre, contraseña con hash (bcrypt) o el
              identificador de Google si te registraste con OAuth.
            </li>
            <li>
              <strong>Datos fiscales</strong>: CUIT, comprobantes (facturas, recibos), montos,
              empleadores, dependientes y demás información necesaria para calcular y presentar
              deducciones en SiRADIG.
            </li>
            <li>
              <strong>Credenciales de ARCA</strong>: CUIT y clave fiscal. Se almacenan cifradas con
              AES-256-GCM y solo se descifran al momento de ejecutar una automatización en tu
              nombre. Nunca quedan en memoria entre sesiones.
            </li>
            <li>
              <strong>Datos de uso</strong>: métricas anónimas de navegación recolectadas con Umami
              Cloud (sin cookies de tracking de terceros, sin huella digital del navegador).
            </li>
            <li>
              <strong>Datos de soporte</strong>: tickets, mensajes y conversaciones que iniciás con
              el equipo de soporte.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">3. Para qué los usamos</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Brindar y operar el servicio: cargar tus deducciones en SiRADIG en tu nombre.</li>
            <li>Calcular tu ahorro fiscal estimado.</li>
            <li>Gestionar tu suscripción y procesar pagos.</li>
            <li>Comunicarnos con vos por temas operativos, de seguridad o de soporte.</li>
            <li>Mejorar la plataforma a partir de métricas agregadas y anónimas.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">4. Subprocesadores</h2>
          <p>
            Para prestar el servicio compartimos datos estrictamente necesarios con los siguientes
            proveedores:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>MercadoPago</strong> — procesamiento de pagos y suscripciones.
            </li>
            <li>
              <strong>Resend</strong> — envío de emails transaccionales (verificación, recupero de
              clave).
            </li>
            <li>
              <strong>OpenAI</strong> — clasificación de categoría de comprobantes mediante IA. Solo
              se envían los datos del comprobante necesarios para la clasificación.
            </li>
            <li>
              <strong>Fly.io</strong> — hosting de la aplicación y la base de datos en la región gru
              (San Pablo, Brasil).
            </li>
            <li>
              <strong>Umami Cloud</strong> — analítica web sin cookies de tracking de terceros.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">5. Tus derechos</h2>
          <p>
            Como titular de los datos tenés derecho de acceso, rectificación, supresión y oposición
            sobre tu información personal, conforme a la Ley 25.326. Para ejercerlos podés
            escribirnos al email de soporte y responderemos en los plazos previstos por la ley.
          </p>
          <p>
            La autoridad de aplicación es la Agencia de Acceso a la Información Pública, ante la que
            podés presentar reclamos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">6. Retención y eliminación</h2>
          <p>
            Conservamos tus datos mientras tengas una cuenta activa o sea necesario para cumplir con
            obligaciones legales y fiscales. Si cerrás tu cuenta, eliminamos o anonimizamos los
            datos personales en un plazo razonable, salvo aquellos que debamos conservar por
            requisitos legales.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">7. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: cifrado
            en tránsito (TLS) y en reposo para credenciales sensibles (AES-256-GCM), control de
            acceso por sesión, y registros de auditoría sobre las automatizaciones. Ningún sistema
            es invulnerable, pero hacemos lo posible para minimizar riesgos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">8. Cambios</h2>
          <p>
            Si actualizamos esta política te lo informaremos por email y publicaremos la nueva
            versión con una fecha de última actualización en esta misma página.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">9. Contacto</h2>
          <p>
            Para consultas sobre privacidad o para ejercer tus derechos podés escribirnos al email
            de soporte que figura en el pie del sitio.
          </p>
        </section>
      </div>
    </article>
  );
}
