import { z } from "zod";
import { cuitSchema } from "./cuit";

export const DEDUCTION_CATEGORIES = [
  "ALQUILER_VIVIENDA",
  "CUOTAS_MEDICO_ASISTENCIALES",
  "GASTOS_MEDICOS",
  "PRIMAS_SEGURO_MUERTE",
  "DONACIONES",
  "SERVICIO_DOMESTICO",
  "INTERESES_HIPOTECARIOS",
  "HONORARIOS_ASISTENCIA_SANITARIA",
  "GASTOS_EDUCATIVOS",
  "GASTOS_SEPELIO",
  "INDUMENTARIA_EQUIPAMIENTO",
  "VEHICULO",
  "VIANDAS_TRANSPORTE",
  "HERRAMIENTAS_EDUCATIVAS",
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
  ALQUILER_VIVIENDA: "Alquiler de vivienda",
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas medico-asistenciales",
  GASTOS_MEDICOS: "Gastos medicos",
  PRIMAS_SEGURO_MUERTE: "Primas de seguro de muerte",
  DONACIONES: "Donaciones",
  SERVICIO_DOMESTICO: "Servicio domestico",
  INTERESES_HIPOTECARIOS: "Intereses hipotecarios",
  HONORARIOS_ASISTENCIA_SANITARIA: "Honorarios asistencia sanitaria",
  GASTOS_EDUCATIVOS: "Gastos educativos",
  GASTOS_SEPELIO: "Gastos de sepelio",
  INDUMENTARIA_EQUIPAMIENTO: "Indumentaria y equipamiento",
  VEHICULO: "Vehiculo",
  VIANDAS_TRANSPORTE: "Viandas y transporte",
  HERRAMIENTAS_EDUCATIVAS: "Herramientas educativas",
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
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fiscalYear: z.coerce.number().int().min(2020).max(2030),
  fiscalMonth: z.coerce.number().int().min(1).max(12),
  description: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = createInvoiceSchema.partial();
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
