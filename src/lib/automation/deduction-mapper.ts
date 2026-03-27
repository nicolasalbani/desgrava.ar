// Maps our DeductionCategory enum to the exact text in SiRADIG dropdowns
// These texts must match EXACTLY what appears in the SiRADIG web interface

export const SIRADIG_CATEGORY_MAP: Record<string, string> = {
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas Médico-Asistenciales",
  PRIMAS_SEGURO_MUERTE: "Primas de Seguro para el caso de muerte",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "Primas de Ahorro correspondientes a Seguros Mixtos",
  APORTES_RETIRO_PRIVADO: "Aportes correspondientes a Planes de Seguro de Retiro Privados",
  DONACIONES: "Donaciones",
  INTERESES_HIPOTECARIOS: "Intereses préstamo hipotecario",
  GASTOS_SEPELIO: "Gastos de sepelio",
  GASTOS_MEDICOS: "Gastos médicos y paramédicos",
  GASTOS_INDUMENTARIA_TRABAJO:
    "Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
  ALQUILER_VIVIENDA: "Alquiler de inmuebles destinados a casa habitación",
  SERVICIO_DOMESTICO: "Deducción del personal doméstico",
  APORTE_SGR: "Aporte a sociedades de garantía recíproca",
  VEHICULOS_CORREDORES: "Vehículos de corredores y viajantes de comercio",
  INTERESES_CORREDORES: "Intereses de corredores y viajantes de comercio",
  GASTOS_EDUCATIVOS: "Gastos de Educación",
  OTRAS_DEDUCCIONES: "Otras deducciones",
};

export const SIRADIG_INVOICE_TYPE_MAP: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_DEBITO_A: "Nota de Débito A",
  NOTA_DEBITO_B: "Nota de Débito B",
  NOTA_DEBITO_C: "Nota de Débito C",
  NOTA_CREDITO_A: "Nota de Crédito A",
  NOTA_CREDITO_B: "Nota de Crédito B",
  NOTA_CREDITO_C: "Nota de Crédito C",
  RECIBO: "Recibo",
  TICKET: "Ticket",
};

// Maps our DeductionCategory enum to the link element IDs in the SiRADIG dropdown
// These IDs come from the #menu_deducciones panel in verMenuDeducciones.do
export const SIRADIG_CATEGORY_LINK_MAP: Record<string, string> = {
  CUOTAS_MEDICO_ASISTENCIALES: "link_agregar_cuotas_medico_asistenciales",
  PRIMAS_SEGURO_MUERTE: "link_agregar_primas_seguro",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "link_agregar_primas_ahorro_seg_mix",
  APORTES_RETIRO_PRIVADO: "link_agregar_aportes_seg_retiro_privado",
  DONACIONES: "link_agregar_donaciones",
  INTERESES_HIPOTECARIOS: "link_agregar_intereses_prestamo_hipotecario",
  GASTOS_SEPELIO: "link_agregar_ded_sepelios",
  GASTOS_MEDICOS: "link_agregar_gastos_medicos",
  GASTOS_INDUMENTARIA_TRABAJO: "link_agregar_gastos_indu_equip",
  ALQUILER_VIVIENDA: "link_agregar_alquiler_inmuebles_inq_o",
  SERVICIO_DOMESTICO: "link_agregar_personal_domestico",
  APORTE_SGR: "link_agregar_aporte_sociedades",
  VEHICULOS_CORREDORES: "link_agregar_vehiculos_corredores_y_viajantes",
  INTERESES_CORREDORES: "link_agregar_gastos_mvri_corredores_y_viajantes",
  GASTOS_EDUCATIVOS: "link_agregar_gastos_educacion",
  OTRAS_DEDUCCIONES: "link_agregar_otras_deducciones",
};

// Link IDs that live inside the hidden #menu_alquiler_inmuebles sub-menu
const ALQUILER_LINK_IDS = new Set([
  "link_agregar_alquiler_inmuebles_inq_n",
  "link_agregar_alquiler_inmuebles_inq_o",
  "link_agregar_alquiler_inmuebles_prop",
]);

export function getSiradigCategoryText(category: string): string {
  return SIRADIG_CATEGORY_MAP[category] ?? category;
}

export function getSiradigInvoiceTypeText(invoiceType: string): string {
  return SIRADIG_INVOICE_TYPE_MAP[invoiceType] ?? invoiceType;
}

export function getSiradigCategoryLinkId(category: string): string | undefined {
  return SIRADIG_CATEGORY_LINK_MAP[category];
}

export function isAlquilerCategory(linkId: string): boolean {
  return ALQUILER_LINK_IDS.has(linkId);
}

/**
 * Returns the SiRADIG link ID for the alquiler deduction based on user ownership.
 * - ownsProperty = true  → Beneficio 10% (Art. 85 inc. k)
 * - ownsProperty = false → Beneficio 40% inquilinos no propietarios (Art. 85 inc. h)
 */
export function getAlquilerLinkId(ownsProperty: boolean): string {
  // inq_o = Beneficio 40% inquilinos NO propietarios (Art. 85 inc. h)
  // inq_n = Beneficio 10% inquilinos propietarios (Art. 85 inc. k)
  // prop  = Locadores (propietarios que alquilan) — NOT for tenants
  return ownsProperty
    ? "link_agregar_alquiler_inmuebles_inq_n"
    : "link_agregar_alquiler_inmuebles_inq_o";
}

export function isEducationCategory(category: string): boolean {
  return category === "GASTOS_EDUCATIVOS";
}

export function isIndumentariaTrabajoCategory(category: string): boolean {
  return category === "GASTOS_INDUMENTARIA_TRABAJO";
}

// Keywords that indicate the provider is a school/educational institution
// (as opposed to a store selling educational tools/supplies)
const SCHOOL_KEYWORDS = [
  "escuela",
  "colegio",
  "universidad",
  "instituto",
  "school",
  "jardín",
  "jardin",
  "liceo",
  "academia",
  "educaci",
  "kindergarten",
  "college",
  "facultad",
  "fundación escuelas",
];

export function isSchoolProvider(denomination: string): boolean {
  const lower = denomination.toLowerCase();
  return SCHOOL_KEYWORDS.some((kw) => lower.includes(kw));
}

// Reverse mapping: SiRADIG legend text (lowercase) → DeductionCategory enum
// Legend text in SiRADIG may differ slightly from dropdown text, so we use
// keyword-based matching rather than exact string comparison.
const REVERSE_CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ["cuotas médico", "cuotas medico"], category: "CUOTAS_MEDICO_ASISTENCIALES" },
  {
    keywords: ["primas de seguro para el caso de muerte", "primas de seguro"],
    category: "PRIMAS_SEGURO_MUERTE",
  },
  { keywords: ["primas de ahorro"], category: "PRIMAS_AHORRO_SEGUROS_MIXTOS" },
  { keywords: ["aportes correspondientes a planes"], category: "APORTES_RETIRO_PRIVADO" },
  { keywords: ["donaciones"], category: "DONACIONES" },
  {
    keywords: ["intereses préstamo hipotecario", "intereses prestamo"],
    category: "INTERESES_HIPOTECARIOS",
  },
  { keywords: ["gastos de sepelio", "sepelio"], category: "GASTOS_SEPELIO" },
  {
    keywords: ["gastos médicos y paramédicos", "gastos medicos y paramedicos"],
    category: "GASTOS_MEDICOS",
  },
  {
    keywords: ["indumentaria y equipamiento", "indumentaria"],
    category: "GASTOS_INDUMENTARIA_TRABAJO",
  },
  {
    keywords: ["alquiler de inmuebles", "locatarios", "inquilinos"],
    category: "ALQUILER_VIVIENDA",
  },
  { keywords: ["personal doméstico", "personal domestico"], category: "SERVICIO_DOMESTICO" },
  {
    keywords: ["sociedades de garantía recíproca", "sociedades de garantia"],
    category: "APORTE_SGR",
  },
  {
    keywords: ["vehículos de corredores", "vehiculos de corredores"],
    category: "VEHICULOS_CORREDORES",
  },
  { keywords: ["intereses de corredores"], category: "INTERESES_CORREDORES" },
  { keywords: ["gastos de educación", "gastos de educacion"], category: "GASTOS_EDUCATIVOS" },
  // OTRAS_DEDUCCIONES intentionally excluded — should only be assigned manually by the user.
  // SiRADIG entries under "Otras deducciones" will be skipped during extraction.
];

/**
 * Reverse-lookup: given a SiRADIG legend/section text, return the matching DeductionCategory enum.
 * Returns undefined if no match found.
 */
export function reverseLookupCategory(legendText: string): string | undefined {
  const lower = legendText.toLowerCase();
  for (const entry of REVERSE_CATEGORY_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.category;
    }
  }
  return undefined;
}

// Reverse mapping: SiRADIG invoice type text → InvoiceType enum
const REVERSE_INVOICE_TYPE_MAP = new Map<string, string>();
for (const [enumVal, text] of Object.entries(SIRADIG_INVOICE_TYPE_MAP)) {
  REVERSE_INVOICE_TYPE_MAP.set(text.toLowerCase(), enumVal);
}

/**
 * Reverse-lookup: given SiRADIG invoice type display text, return the InvoiceType enum value.
 */
export function reverseLookupInvoiceType(typeText: string): string | undefined {
  return REVERSE_INVOICE_TYPE_MAP.get(typeText.toLowerCase());
}
