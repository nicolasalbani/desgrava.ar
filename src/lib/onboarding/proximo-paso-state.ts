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
  | "review-recibos"
  | "register-trabajador"
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
  pendingInvoiceCount: number;
  pendingReceiptCount: number;
  totalDeducibleInvoices: number;
  totalDeducibleReceipts: number;
  hasUnregisteredWorker: boolean;
  allSubmitted: boolean;
  /** 1-indexed month — defaults to the current month in caller. */
  currentMonth: number;
}

/**
 * Pure state machine for the "Próximo paso" card. Branches in declared priority order:
 * 1. Any tracked import is RUNNING → "Estamos descargando…"
 * 2. There are unsent deducible invoices → "Revisá y presentá {month}"
 * 3. Pending recibos but no trabajador registered → "Registrá a tu trabajador"
 * 4. There are unsent recibos → "Tenés N recibos sin desgravar"
 * 5. No deducible invoices or recibos exist → "Importá tus comprobantes"
 * 6. Everything submitted → "Presentá tu F.572 web"
 * 7. Otherwise → "Todo al día"
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

  if (input.pendingInvoiceCount > 0) {
    return {
      variant: "review-month",
      title: `Revisá y presentá ${monthName}`,
      body: `${input.pendingInvoiceCount} comprobante${input.pendingInvoiceCount === 1 ? "" : "s"} esperan tu confirmación antes de presentarse a SiRADIG.`,
      ctas: [
        { label: "Revisar comprobantes", href: "/comprobantes", variant: "primary" },
        { label: "Importar desde ARCA", action: "import-comprobantes", variant: "secondary" },
      ],
    };
  }

  if (input.pendingReceiptCount > 0 && input.hasUnregisteredWorker) {
    return {
      variant: "register-trabajador",
      title: "Registrá a tu trabajador",
      body: `Importamos ${input.pendingReceiptCount} recibo${input.pendingReceiptCount === 1 ? "" : "s"} pero falta cargar el trabajador para poder desgravarlos.`,
      ctas: [{ label: "Ir a Trabajadores", href: "/trabajadores", variant: "primary" }],
    };
  }

  if (input.pendingReceiptCount > 0) {
    return {
      variant: "review-recibos",
      title: `Tenés ${input.pendingReceiptCount} recibo${input.pendingReceiptCount === 1 ? "" : "s"} sin desgravar`,
      body: "Mandalos a SiRADIG para sumar la deducción del personal doméstico.",
      ctas: [{ label: "Revisar recibos", href: "/recibos", variant: "primary" }],
    };
  }

  if (input.totalDeducibleInvoices === 0 && input.totalDeducibleReceipts === 0) {
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
