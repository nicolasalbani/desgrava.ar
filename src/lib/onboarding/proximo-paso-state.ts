const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type ProximoPasoVariant =
  | "importing"
  | "review-month"
  | "no-invoices"
  | "ready-to-present"
  | "all-set";

export interface ProximoPasoCta {
  label: string;
  href?: string;
  action?: "import-comprobantes";
  variant: "primary" | "secondary";
}

export interface ProximoPasoCardState {
  variant: ProximoPasoVariant;
  title: string;
  body: string;
  ctas: ProximoPasoCta[];
}

export interface ProximoPasoInputs {
  hasRunningImport: boolean;
  pendingCount: number;
  totalDeducible: number;
  allSubmitted: boolean;
  /** 1-indexed month — defaults to the current month in caller. */
  currentMonth: number;
}

/**
 * Pure state machine for the "Próximo paso" card. Branches in declared priority order:
 * 1. Any tracked import is RUNNING → "Estamos descargando…"
 * 2. There are unsent deducible invoices → "Revisá y presentá {month}"
 * 3. No deducible invoices exist → "Importá tus comprobantes"
 * 4. All deducibles are SUBMITTED → "Presentá tu F.572 web"
 * 5. Otherwise → "Todo al día"
 */
export function deriveProximoPasoState(input: ProximoPasoInputs): ProximoPasoCardState {
  const monthName = MONTH_NAMES[input.currentMonth - 1] ?? "este mes";

  if (input.hasRunningImport) {
    return {
      variant: "importing",
      title: "Estamos descargando tus datos de ARCA",
      body: "Vuelvo en unos minutos con tus comprobantes y recibos.",
      ctas: [
        {
          label: "Importar desde ARCA",
          action: "import-comprobantes",
          variant: "primary",
        },
      ],
    };
  }

  if (input.pendingCount > 0) {
    return {
      variant: "review-month",
      title: `Revisá y presentá ${monthName}`,
      body: `${input.pendingCount} comprobante${input.pendingCount === 1 ? "" : "s"} esperan tu confirmación antes de presentarse a SiRADIG.`,
      ctas: [
        { label: "Revisar comprobantes", href: "/comprobantes", variant: "primary" },
        { label: "Importar desde ARCA", action: "import-comprobantes", variant: "secondary" },
      ],
    };
  }

  if (input.totalDeducible === 0) {
    return {
      variant: "no-invoices",
      title: "Importá tus comprobantes",
      body: "Traé los comprobantes que ARCA tiene cargados a tu nombre.",
      ctas: [{ label: "Importar desde ARCA", action: "import-comprobantes", variant: "primary" }],
    };
  }

  if (input.allSubmitted) {
    return {
      variant: "ready-to-present",
      title: "Presentá tu F.572 web",
      body: "Ya enviaste tus deducciones. Confirmá la presentación en SiRADIG.",
      ctas: [{ label: "Ir a Presentaciones", href: "/presentaciones", variant: "primary" }],
    };
  }

  return {
    variant: "all-set",
    title: "Todo al día",
    body: "Te aviso cuando haya algo para hacer.",
    ctas: [],
  };
}
