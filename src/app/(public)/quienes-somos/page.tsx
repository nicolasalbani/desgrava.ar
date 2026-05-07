// To set a real photo: drop a square JPG (≥ 400×400) at
// `public/images/team/<slug>.jpg`. No code changes required.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Quiénes somos · desgrava.ar",
  description:
    "desgrava.ar fue fundado por Nicolás Albani con la lógica fiscal validada por el contador Nicolás Barbolla — para que recuperes lo que Ganancias te saca, todos los meses.",
  alternates: {
    canonical: "https://desgrava.ar/quienes-somos",
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar/quienes-somos",
    title: "Quiénes somos · desgrava.ar",
    description:
      "desgrava.ar fue fundado por Nicolás Albani con la lógica fiscal validada por el contador Nicolás Barbolla — para que recuperes lo que Ganancias te saca, todos los meses.",
  },
};

interface TeamLink {
  href: string;
  label: string;
  icon: typeof Linkedin;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  photoSrc: string;
  links: TeamLink[];
}

const TEAM: TeamMember[] = [
  {
    name: "Nicolás Albani",
    role: "Fundador",
    bio: "Construye software y lidera equipos de ingeniería hace más de 15 años, trabajando con empresas líderes de América Latina, Estados Unidos y Europa. Diseña y construye el producto end-to-end: la integración con ARCA, la automatización del SiRADIG y toda la experiencia de uso.",
    photoSrc: "/images/team/nicolas-albani.jpg",
    links: [
      {
        href: "https://www.linkedin.com/in/nicolasalbani/",
        label: "LinkedIn",
        icon: Linkedin,
      },
    ],
  },
  {
    name: "Nicolás Barbolla",
    role: "Asesor contable",
    bio: "Contador público especialista en tributación, con más de 20 años de experiencia. Dirige el Estudio Barbolla y Asociados. Supervisa la lógica tributaria de desgrava.ar para garantizar que cada deducción se calcule según la normativa vigente de ARCA.",
    photoSrc: "/images/team/nicolas-barbolla.jpg",
    links: [
      {
        href: "https://estudiobya.com.ar/",
        label: "Estudio Barbolla y Asociados",
        icon: ExternalLink,
      },
      {
        href: "https://www.linkedin.com/in/nicol%C3%A1s-barbolla-524245310/",
        label: "LinkedIn",
        icon: Linkedin,
      },
    ],
  },
];

export default function QuienesSomosPage() {
  return (
    <div className="bg-background overflow-x-hidden">
      {/* Hero */}
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-8 md:px-6 md:pt-16 md:pb-12">
          <header className="space-y-3 text-center md:text-left">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              El equipo detrás de desgrava.ar
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
              Quiénes somos
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed md:mx-0">
              Los empleados en relación de dependencia en Argentina pierden plata todos los meses
              por no presentar el SiRADIG — y cuando lo presentan, suele ser un trámite repetitivo
              que un contador carga una vez al año, en marzo. Convertimos ese trámite en software
              para que se haga todos los meses, automáticamente, sin que tengas que pensar en él.
              Por eso construimos desgrava.ar.
            </p>
          </header>
        </div>
      </section>

      {/* Team grid */}
      <section className="bg-muted/50 border-border border-b">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="border-border bg-card flex flex-col rounded-2xl border p-6 sm:p-8"
              >
                <div className="bg-muted relative mx-auto aspect-square w-32 overflow-hidden rounded-full sm:w-40">
                  <Image
                    src={member.photoSrc}
                    alt={member.name}
                    fill
                    sizes="(min-width: 640px) 160px, 128px"
                    className="object-cover"
                  />
                </div>
                <h2 className="text-foreground mt-4 text-center text-xl font-semibold">
                  {member.name}
                </h2>
                <p className="text-primary text-center text-sm font-medium">{member.role}</p>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{member.bio}</p>
                <div className="mt-4 flex flex-col gap-2">
                  {member.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section>
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 text-center md:px-6 md:py-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            ¿Querés probar lo que construimos?
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
