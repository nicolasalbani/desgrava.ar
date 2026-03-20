import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PricingTier {
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Gratis",
    tagline: "Proba la plataforma",
    price: "$0",
    period: "por 30 dias",
    features: [
      "Simulador de deducciones",
      "Carga manual de facturas (hasta 20)",
      "Clasificacion AI de categoria",
    ],
    cta: "Empeza gratis",
    href: "/login",
    highlighted: false,
  },
  {
    name: "Personal",
    tagline: "Para empleados en relacion de dependencia",
    price: "$4.999",
    period: "/mes",
    features: [
      "Todo lo de Gratis",
      "Facturas ilimitadas",
      "Importacion desde ARCA",
      "Envio automatico a SiRADIG",
      "Soporte por email",
    ],
    cta: "Proba 30 dias gratis",
    href: "/login",
    highlighted: true,
  },
  {
    name: "Contadores",
    tagline: "Para profesionales con multiples clientes",
    price: "$14.999",
    period: "/mes",
    features: [
      "Todo lo de Personal",
      "Multiples CUITs / clientes",
      "Gestion de empleados",
      "Soporte prioritario",
    ],
    cta: "Contactanos",
    href: "/login",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Planes y precios
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Elegi el plan que mejor se adapte a tus necesidades
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-lg border p-6 ${
              tier.highlighted
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-muted/50"
            }`}
          >
            {tier.highlighted && (
              <div className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-medium">
                Recomendado
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-foreground text-lg font-semibold">{tier.name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{tier.tagline}</p>
            </div>

            <div className="mb-6">
              <span className="text-foreground text-3xl font-bold">{tier.price}</span>
              <span className="text-muted-foreground ml-1 text-sm">{tier.period}</span>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant={tier.highlighted ? "default" : "outline"} className="w-full" asChild>
              <Link href={tier.href}>{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
