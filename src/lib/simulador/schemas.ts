import { z } from "zod";

export const simuladorInputSchema = z.object({
  salarioBrutoMensual: z.number().positive("El salario debe ser mayor a 0"),
  tieneHijos: z.number().int().min(0).max(20).default(0),
  tieneConyuge: z.boolean().default(false),
  incluyeSindicato: z.boolean().default(false),
  deducciones: z
    .array(
      z.object({
        category: z.string(),
        monthlyAmount: z.number().positive("El monto debe ser mayor a 0"),
      }),
    )
    .default([]),
});

export type SimuladorInput = z.infer<typeof simuladorInputSchema>;

export const simuladorSimplifiedInputSchema = z.object({
  tieneHijos: z.number().int().min(0).max(20).default(0),
  tieneConyuge: z.boolean().default(false),
  esPropietario: z.boolean().default(false),
  interesesHipotecariosMensual: z.number().min(0).default(0),
  deducciones: z
    .array(
      z.object({
        category: z.string(),
        amount: z.number().positive("El monto debe ser mayor a 0"),
      }),
    )
    .default([]),
});

export type SimuladorSimplifiedInput = z.infer<typeof simuladorSimplifiedInputSchema>;
