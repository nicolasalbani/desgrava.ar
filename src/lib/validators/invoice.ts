import { z } from "zod";
import { cuitSchema } from "./cuit";

export const DEDUCTION_CATEGORIES = [
  "CUOTAS_MEDICO_ASISTENCIALES",
  "PRIMAS_SEGURO_MUERTE",
  "PRIMAS_AHORRO_SEGUROS_MIXTOS",
  "APORTES_RETIRO_PRIVADO",
  "DONACIONES",
  "INTERESES_HIPOTECARIOS",
  "GASTOS_SEPELIO",
  "GASTOS_MEDICOS",
  "GASTOS_INDUMENTARIA_TRABAJO",
  "ALQUILER_VIVIENDA",
  "SERVICIO_DOMESTICO",
  "APORTE_SGR",
  "VEHICULOS_CORREDORES",
  "INTERESES_CORREDORES",
  "GASTOS_EDUCATIVOS",
  "OTRAS_DEDUCCIONES",
] as const;

export const INVOICE_TYPES = [
  "FACTURA_A",
  "FACTURA_B",
  "FACTURA_C",
  "NOTA_DEBITO_A",
  "NOTA_DEBITO_B",
  "NOTA_DEBITO_C",
  "NOTA_CREDITO_A",
  "NOTA_CREDITO_B",
  "NOTA_CREDITO_C",
  "RECIBO",
  "TICKET",
] as const;

export const DEDUCTION_CATEGORY_LABELS: Record<string, string> = {
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas Médico-Asistenciales",
  PRIMAS_SEGURO_MUERTE: "Primas de Seguro para el caso de muerte/riesgo de muerte",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "Primas de Ahorro correspondientes a Seguros Mixtos",
  APORTES_RETIRO_PRIVADO: "Aportes correspondientes a Planes de Seguro de Retiro Privados",
  DONACIONES: "Donaciones",
  INTERESES_HIPOTECARIOS: "Intereses préstamo hipotecario",
  GASTOS_SEPELIO: "Gastos de sepelio",
  GASTOS_MEDICOS: "Gastos médicos y paramédicos",
  GASTOS_INDUMENTARIA_TRABAJO: "Gastos de Adquisición de Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
  ALQUILER_VIVIENDA: "Alquiler de inmuebles destinados a casa habitación",
  SERVICIO_DOMESTICO: "Deducción del personal doméstico",
  APORTE_SGR: "Aporte a sociedades de garantía recíproca",
  VEHICULOS_CORREDORES: "Vehículos de corredores y viajantes de comercio",
  INTERESES_CORREDORES: "Intereses de corredores y viajantes de comercio",
  GASTOS_EDUCATIVOS: "Gastos de Educación",
  OTRAS_DEDUCCIONES: "Otras deducciones",
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_DEBITO_A: "Nota de Debito A",
  NOTA_DEBITO_B: "Nota de Debito B",
  NOTA_DEBITO_C: "Nota de Debito C",
  NOTA_CREDITO_A: "Nota de Credito A",
  NOTA_CREDITO_B: "Nota de Credito B",
  NOTA_CREDITO_C: "Nota de Credito C",
  RECIBO: "Recibo",
  TICKET: "Ticket",
};

export const createInvoiceSchema = z.object({
  deductionCategory: z.enum(DEDUCTION_CATEGORIES),
  providerCuit: cuitSchema,
  providerName: z.string().optional(),
  invoiceType: z.enum(INVOICE_TYPES),
  invoiceNumber: z.string().optional(), // "XXXXX-YYYYYYYY"
  invoiceDate: z.coerce.date().optional(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fiscalYear: z.coerce.number().int().min(2020).max(2030),
  fiscalMonth: z.coerce.number().int().min(1).max(12),
  description: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = createInvoiceSchema.partial();
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
