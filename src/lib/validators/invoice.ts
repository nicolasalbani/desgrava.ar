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

export const ALL_DEDUCTION_CATEGORIES = [...DEDUCTION_CATEGORIES, "NO_DEDUCIBLE"] as const;

export const INVOICE_TYPES = [
  "FACTURA_B",
  "FACTURA_C",
  "NOTA_DEBITO_B",
  "NOTA_DEBITO_C",
  "NOTA_CREDITO_B",
  "NOTA_CREDITO_C",
  "RECIBO_B",
  "RECIBO_C",
  "NOTA_VENTA_B",
  "NOTA_VENTA_C",
  "DOCUMENTO_ADUANERO",
  "OTRO_COMPROBANTE_B",
  "OTRO_COMPROBANTE_C",
  "TIQUE_FACTURA_B",
  "OTROS_EXCEPTUADOS",
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
  GASTOS_INDUMENTARIA_TRABAJO:
    "Gastos de Adquisición de Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
  ALQUILER_VIVIENDA: "Alquiler de inmuebles destinados a casa habitación",
  SERVICIO_DOMESTICO: "Deducción del personal doméstico",
  APORTE_SGR: "Aporte a sociedades de garantía recíproca",
  VEHICULOS_CORREDORES: "Vehículos de corredores y viajantes de comercio",
  INTERESES_CORREDORES: "Intereses de corredores y viajantes de comercio",
  GASTOS_EDUCATIVOS: "Gastos de Educación",
  OTRAS_DEDUCCIONES: "Otras deducciones",
  NO_DEDUCIBLE: "No deducible",
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_DEBITO_B: "Nota de Débito B",
  NOTA_DEBITO_C: "Nota de Débito C",
  NOTA_CREDITO_B: "Nota de Crédito B",
  NOTA_CREDITO_C: "Nota de Crédito C",
  RECIBO_B: "Recibo B",
  RECIBO_C: "Recibo C",
  NOTA_VENTA_B: "Nota de Venta al contado B",
  NOTA_VENTA_C: "Nota de Venta al contado C",
  DOCUMENTO_ADUANERO: "Documento Aduanero",
  OTRO_COMPROBANTE_B: "Otro comprobante B (RG 1415)",
  OTRO_COMPROBANTE_C: "Otro comprobante C (RG 1415)",
  TIQUE_FACTURA_B: "Tique-factura B",
  OTROS_EXCEPTUADOS: "Otros comp. doc. exceptuados",
};

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export type InvoiceNumberFormat = {
  regex: RegExp;
  description: string;
  example: string;
};

const STANDARD_INVOICE_NUMBER_FORMAT: InvoiceNumberFormat = {
  regex: /^\d{5}-\d{8}$/,
  description: "Formato: XXXXX-XXXXXXXX (punto de venta - número)",
  example: "00001-00012345",
};

const FREE_FORM_INVOICE_NUMBER_FORMATS: Record<string, InvoiceNumberFormat> = {
  DOCUMENTO_ADUANERO: {
    regex: /^\S.*$/,
    description: "Número identificador del despacho aduanero",
    example: "19001MANI000001A",
  },
  OTROS_EXCEPTUADOS: {
    regex: /^\S.*$/,
    description: "Número identificador (sin formato específico)",
    example: "Identificador",
  },
};

export function getInvoiceNumberFormat(invoiceType: InvoiceType): InvoiceNumberFormat {
  return FREE_FORM_INVOICE_NUMBER_FORMATS[invoiceType] ?? STANDARD_INVOICE_NUMBER_FORMAT;
}

export function invoiceNumberMatchesType(invoiceNumber: string, invoiceType: InvoiceType): boolean {
  const { regex } = getInvoiceNumberFormat(invoiceType);
  return regex.test(invoiceNumber);
}

const invoiceBaseSchema = z.object({
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
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  familyDependentId: z.string().nullable().optional(),
});

function invoiceNumberFormatIssue(
  invoiceNumber: string | undefined,
  invoiceType: InvoiceType | undefined,
): { message: string } | null {
  if (!invoiceNumber || !invoiceType) return null;
  if (invoiceNumberMatchesType(invoiceNumber, invoiceType)) return null;
  const { example } = getInvoiceNumberFormat(invoiceType);
  return { message: `Formato inválido. Ejemplo: ${example}` };
}

export const createInvoiceSchema = invoiceBaseSchema
  .refine(
    (data) => data.deductionCategory !== "ALQUILER_VIVIENDA" || data.contractStartDate != null,
    {
      message: "La fecha de inicio del contrato es obligatoria para alquiler",
      path: ["contractStartDate"],
    },
  )
  .refine(
    (data) => data.deductionCategory !== "ALQUILER_VIVIENDA" || data.contractEndDate != null,
    {
      message: "La fecha de fin del contrato es obligatoria para alquiler",
      path: ["contractEndDate"],
    },
  )
  .superRefine((data, ctx) => {
    const issue = invoiceNumberFormatIssue(data.invoiceNumber, data.invoiceType);
    if (issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["invoiceNumber"],
        message: issue.message,
      });
    }
  });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = invoiceBaseSchema.partial().superRefine((data, ctx) => {
  const issue = invoiceNumberFormatIssue(data.invoiceNumber, data.invoiceType);
  if (issue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["invoiceNumber"],
      message: issue.message,
    });
  }
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
