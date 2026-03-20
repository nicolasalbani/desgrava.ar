"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PricingTier {
  name: string;
  tagline: string;
  monthlyPrice: number; // 0 = free
  annualMonthlyPrice?: number; // per-month price when billed annually
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
  freePeriod?: string; // e.g. "por 30 dias"
}

const tiers: PricingTier[] = [
  {
    name: "Gratis",
    tagline: "Proba la plataforma",
    monthlyPrice: 0,
    freePeriod: "por 30 dias",
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
    monthlyPrice: 5999,
    annualMonthlyPrice: 4999,
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
    monthlyPrice: 19999,
    annualMonthlyPrice: 15999,
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

function formatPrice(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          Planes y precios
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          Elegi el plan que mejor se adapte a tus necesidades
        </p>

        {/* Billing toggle */}
        <div className="mt-6 inline-flex items-center gap-3">
          <span
            className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}
          >
            Mensual
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              isAnnual ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                isAnnual ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}
          >
            Anual
          </span>
          {isAnnual && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Ahorra
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const isFree = tier.monthlyPrice === 0;
          const effectiveMonthly = isFree
            ? 0
            : isAnnual
              ? (tier.annualMonthlyPrice ?? tier.monthlyPrice)
              : tier.monthlyPrice;
          const annualTotal = effectiveMonthly * 12;
          const discountPct =
            !isFree && tier.annualMonthlyPrice
              ? Math.round((1 - tier.annualMonthlyPrice / tier.monthlyPrice) * 100)
              : 0;

          return (
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
                {isFree ? (
                  <>
                    <span className="text-foreground text-3xl font-bold">$0</span>
                    <span className="text-muted-foreground ml-1 text-sm">{tier.freePeriod}</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground text-3xl font-bold">
                      {formatPrice(effectiveMonthly)}
                    </span>
                    <span className="text-muted-foreground ml-1 text-sm">/mes</span>
                    {isAnnual && tier.annualMonthlyPrice && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-muted-foreground text-sm line-through">
                          {formatPrice(tier.monthlyPrice)}/mes
                        </span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          -{discountPct}%
                        </span>
                      </div>
                    )}
                    {isAnnual && tier.annualMonthlyPrice && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatPrice(annualTotal)}/año facturado anualmente
                      </p>
                    )}
                  </>
                )}
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
          );
        })}
      </div>
    </div>
  );
}
