// Maps our DeductionCategory enum to the exact text in SiRADIG dropdowns
// These texts must match EXACTLY what appears in the SiRADIG web interface

export const SIRADIG_CATEGORY_MAP: Record<string, string> = {
  ALQUILER_VIVIENDA: "Alquileres",
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas Medico Asistenciales",
  GASTOS_MEDICOS: "Gastos Medicos y Paramédicos",
  PRIMAS_SEGURO_MUERTE: "Primas de Seguro para caso de muerte",
  DONACIONES: "Donaciones",
  SERVICIO_DOMESTICO: "Casas Particulares",
  INTERESES_HIPOTECARIOS: "Intereses Credito Hipotecario",
  HONORARIOS_ASISTENCIA_SANITARIA: "Honorarios Servicio Asistencia Sanitaria, Médica y Paramédica",
  GASTOS_EDUCATIVOS: "Gastos de Educación",
  GASTOS_SEPELIO: "Gastos de Sepelio",
  INDUMENTARIA_EQUIPAMIENTO: "Indumentaria y Equipamiento",
  VEHICULO: "Vehículo",
  VIANDAS_TRANSPORTE: "Viandas y Transporte",
  HERRAMIENTAS_EDUCATIVAS: "Herramientas Educativas",
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

export function getSiradigCategoryText(category: string): string {
  return SIRADIG_CATEGORY_MAP[category] ?? category;
}

export function getSiradigInvoiceTypeText(invoiceType: string): string {
  return SIRADIG_INVOICE_TYPE_MAP[invoiceType] ?? invoiceType;
}
