import type { Metadata } from "next";

const LAST_UPDATED = "2026-05-01";

export const metadata: Metadata = {
  title: "Política de cookies · desgrava.ar",
  description: "Cómo desgrava.ar usa cookies y tecnologías similares.",
};

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10">
        <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
          Política de cookies
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Última actualización: {LAST_UPDATED}</p>
      </header>

      <div className="text-foreground space-y-8 text-base leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">1. Qué son las cookies</h2>
          <p>
            Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador para
            recordar información entre visitas. En desgrava.ar las usamos lo mínimo posible y nunca
            con fines de tracking publicitario.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">
            2. Cookies estrictamente necesarias
          </h2>
          <p>
            Usamos cookies esenciales para que la plataforma funcione: principalmente la cookie de
            sesión gestionada por NextAuth, que mantiene tu sesión iniciada de forma segura.
          </p>
          <p>
            Estas cookies son imprescindibles para usar el servicio. Sin ellas no podrías iniciar
            sesión.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">3. Analítica</h2>
          <p>
            Para entender cómo se usa el sitio utilizamos Umami Cloud, una herramienta de analítica
            web enfocada en privacidad: <strong>no usa cookies de tracking de terceros</strong>, no
            crea perfiles de usuario y no construye huellas digitales del navegador. Las métricas
            que vemos son agregadas y anónimas (cantidad de visitas, páginas vistas, referrers).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">4. Cookies de terceros</h2>
          <p>
            No usamos cookies de redes publicitarias ni de redes sociales para perfilar tu
            navegación. Si en el futuro incorporamos pixeles de Meta, Google u otras plataformas,
            actualizaremos esta política y agregaremos un banner de consentimiento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">5. Cómo deshabilitarlas</h2>
          <p>
            Podés borrar o bloquear cookies desde la configuración de tu navegador. Tené en cuenta
            que si bloqueás las cookies estrictamente necesarias no vas a poder iniciar sesión en la
            plataforma.
          </p>
          <p>
            Cada navegador tiene su propio menú de configuración: buscá en Preferencias o Ajustes la
            sección de Privacidad o Seguridad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-xl font-semibold">6. Cambios</h2>
          <p>
            Si actualizamos esta política publicaremos la nueva versión con una fecha de última
            actualización en esta misma página.
          </p>
        </section>
      </div>
    </article>
  );
}
