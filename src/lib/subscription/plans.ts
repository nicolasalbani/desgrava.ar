export const SUBSCRIPTION_PLANS = {
  PERSONAL: {
    name: "Personal",
    tagline: "Para empleados en relacion de dependencia",
    monthlyPrice: 5999,
    annualMonthlyPrice: 4999,
    features: [
      "Facturas ilimitadas",
      "Importacion desde ARCA",
      "Envio automatico a ARCA",
      "Carga de personal doméstico",
      "Soporte por WhatsApp",
    ],
  },
} as const;

export const TRIAL_DURATION_DAYS = 30;

/** Annual total = annualMonthlyPrice × 12 */
export function getAnnualTotal(): number {
  return SUBSCRIPTION_PLANS.PERSONAL.annualMonthlyPrice * 12;
}

/** Discount percentage when paying annually */
export function getAnnualDiscountPercent(): number {
  const { monthlyPrice, annualMonthlyPrice } = SUBSCRIPTION_PLANS.PERSONAL;
  return Math.round((1 - annualMonthlyPrice / monthlyPrice) * 100);
}

export function formatPriceARS(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
