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
  GASTOS_INDUMENTARIA_TRABAJO: "Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
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

export function isEducationCategory(category: string): boolean {
  return category === "GASTOS_EDUCATIVOS";
}

export function isIndumentariaTrabajoCategory(category: string): boolean {
  return category === "GASTOS_INDUMENTARIA_TRABAJO";
}

// Keywords that indicate the provider is a school/educational institution
// (as opposed to a store selling educational tools/supplies)
const SCHOOL_KEYWORDS = [
  "escuela", "colegio", "universidad", "instituto", "school",
  "jardín", "jardin", "liceo", "academia", "educaci",
  "kindergarten", "college", "facultad", "fundación escuelas",
];

export function isSchoolProvider(denomination: string): boolean {
  const lower = denomination.toLowerCase();
  return SCHOOL_KEYWORDS.some((kw) => lower.includes(kw));
}
