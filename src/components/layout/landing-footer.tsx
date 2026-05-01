import Link from "next/link";
import Image from "next/image";
import { Twitter, MessageCircle, Mail } from "lucide-react";
import { sectionLinks } from "@/lib/landing/section-links";

const TWITTER_URL = "https://x.com/desgrava_ar";

export function LandingFooter() {
  const supportEmail = process.env.SUPPORT_EMAIL;
  const supportWhatsapp = process.env.SUPPORT_WHATSAPP;
  const year = new Date().getFullYear();

  return (
    <footer className="border-border mt-auto border-t">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 text-xl font-bold">
              <Image
                src="/logo.png"
                alt="desgrava.ar"
                width={40}
                height={40}
                className="h-10 w-10"
              />
              desgrava.ar
            </Link>
            <p className="text-muted-foreground text-sm">
              Recuperá la plata que Ganancias te saca.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={TWITTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="text-muted-foreground hover:text-foreground inline-flex h-11 w-11 items-center justify-center transition-colors"
              >
                <Twitter className="h-4 w-4" aria-hidden="true" />
              </a>
              {supportWhatsapp && (
                <a
                  href={`https://wa.me/${supportWhatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="text-muted-foreground hover:text-foreground inline-flex h-11 w-11 items-center justify-center transition-colors"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Email"
                  className="text-muted-foreground hover:text-foreground inline-flex h-11 w-11 items-center justify-center transition-colors"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">Producto</h3>
            <ul className="flex flex-col gap-y-2">
              {sectionLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                >
                  Iniciar sesión
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">Contacto</h3>
            <ul className="flex flex-col gap-y-2">
              {supportEmail && (
                <li>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm break-all transition-colors"
                  >
                    {supportEmail}
                  </a>
                </li>
              )}
              {supportWhatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${supportWhatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              <li>
                <a
                  href={TWITTER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                >
                  X: @desgrava_ar
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">Legal</h3>
            <ul className="flex flex-col gap-y-2">
              <li>
                <Link
                  href="/terminos"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                >
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link
                  href="/privacidad"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                >
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center text-sm transition-colors"
                >
                  Política de cookies
                </Link>
              </li>
              <li>
                <p className="text-muted-foreground pt-1 text-xs italic">
                  Sin afiliación a ARCA/AFIP
                </p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-border mt-12 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">© {year} desgrava.ar</p>
          <p className="text-muted-foreground text-xs">Hecho en 🇦🇷 Argentina</p>
        </div>
      </div>
    </footer>
  );
}
