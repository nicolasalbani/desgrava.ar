"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  formatPriceARS,
  getAnnualTotal,
  TRIAL_DURATION_DAYS,
} from "@/lib/subscription/plans";

interface PricingTier {
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualMonthlyPrice?: number;
  features: readonly string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

const personal = SUBSCRIPTION_PLANS.PERSONAL;

const tiers: PricingTier[] = [
  {
    name: "Personal",
    tagline: personal.tagline,
    monthlyPrice: personal.monthlyPrice,
    annualMonthlyPrice: personal.annualMonthlyPrice,
    features: personal.features,
    cta: `Probá ${TRIAL_DURATION_DAYS} días gratis`,
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
        </div>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
        {tiers.map((tier) => {
          const effectiveMonthly = isAnnual
            ? (tier.annualMonthlyPrice ?? tier.monthlyPrice)
            : tier.monthlyPrice;
          const discountPct = tier.annualMonthlyPrice
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
                <span className="text-foreground text-3xl font-bold">
                  {formatPriceARS(effectiveMonthly)}
                </span>
                <span className="text-muted-foreground ml-1 text-sm">/mes</span>
                {isAnnual && tier.annualMonthlyPrice && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted-foreground text-sm line-through">
                      {formatPriceARS(tier.monthlyPrice)}/mes
                    </span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      -{discountPct}%
                    </span>
                  </div>
                )}
                {isAnnual && tier.annualMonthlyPrice && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {tier.name === "Personal"
                      ? formatPriceARS(getAnnualTotal())
                      : formatPriceARS(tier.annualMonthlyPrice * 12)}
                    /año facturado anualmente
                  </p>
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
