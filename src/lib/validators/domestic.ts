import { z } from "zod";
import { cuitSchema } from "./cuit";

// ── Constants ────────────────────────────────────────────────

export const TIPO_TRABAJO_OPTIONS = [
  "Personal para tareas generales",
  "Asistencia y cuidado de personas",
  "Caseros",
  "Otros",
] as const;

export const HORAS_SEMANALES_OPTIONS = [
  "Menos de 12 horas",
  "De 12 a menos de 16 horas",
  "Desde 16 a más h",
] as const;

export const CONDICION_OPTIONS = ["Activo", "Baja"] as const;

export const MODALIDAD_PAGO_OPTIONS = ["Diaria", "Mensual"] as const;

export const MODALIDAD_TRABAJO_OPTIONS = [
  "Con retiro para distintos empleadores",
  "Con retiro para un solo empleador",
  "Sin retiro",
] as const;

export const TIPO_PAGO_OPTIONS = ["APORTES", "LRT", "CONTRIBUCIONES"] as const;

// ── Worker schemas ──────────────────────────────────────────

export const createDomesticWorkerSchema = z.object({
  cuil: cuitSchema,
  apellidoNombre: z.string().min(1, "El nombre es requerido"),
  tipoTrabajo: z.string().min(1, "El tipo de trabajo es requerido"),
  domicilioLaboral: z.string().optional(),
  horasSemanales: z.string().optional(),
  condicion: z.string().default("Activo"),
  obraSocial: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  fechaIngreso: z.string().optional(),
  modalidadPago: z.string().optional(),
  modalidadTrabajo: z.string().optional(),
  remuneracionPactada: z.coerce.number().nonnegative().optional(),
  fiscalYear: z.coerce.number().int().min(2020).max(2030),
});

export type CreateDomesticWorkerInput = z.infer<typeof createDomesticWorkerSchema>;

export const updateDomesticWorkerSchema = createDomesticWorkerSchema.partial();
export type UpdateDomesticWorkerInput = z.infer<typeof updateDomesticWorkerSchema>;

// ── Receipt schemas ─────────────────────────────────────────

export const paymentDetailSchema = z.object({
  tipoPago: z.enum(TIPO_PAGO_OPTIONS),
  importe: z.coerce.number().nonnegative(),
  fechaPago: z.string().optional(), // dd/mm/yyyy
});

export type PaymentDetail = z.infer<typeof paymentDetailSchema>;

export const createDomesticReceiptSchema = z.object({
  domesticWorkerId: z.string().optional(),
  fiscalYear: z.coerce.number().int().min(2020).max(2030),
  fiscalMonth: z.coerce.number().int().min(1).max(12),
  periodo: z.string().min(1, "El periodo es requerido"),
  categoriaProfesional: z.string().optional(),
  modalidadPrestacion: z.string().optional(),
  horasSemanales: z.string().optional(),
  modalidadLiquidacion: z.string().optional(),
  totalHorasTrabajadas: z.string().optional(),
  basico: z.coerce.number().nonnegative().optional(),
  antiguedad: z.coerce.number().nonnegative().optional(),
  viaticos: z.coerce.number().nonnegative().optional(),
  presentismo: z.coerce.number().nonnegative().optional(),
  otros: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().positive("El total debe ser mayor a 0"),
  paymentDetails: z.array(paymentDetailSchema).optional(),
  contributionAmount: z.coerce.number().nonnegative().optional(),
  contributionDate: z.string().optional(),
});

export type CreateDomesticReceiptInput = z.infer<typeof createDomesticReceiptSchema>;

export const updateDomesticReceiptSchema = createDomesticReceiptSchema.partial();
export type UpdateDomesticReceiptInput = z.infer<typeof updateDomesticReceiptSchema>;

// ── Labels ──────────────────────────────────────────────────

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function monthName(month: number): string {
  return MESES[month - 1] ?? `Mes ${month}`;
}

export function periodoLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`;
}
