import { z } from "zod";
import { cuitSchema } from "./cuit";

export const saveCredentialsSchema = z.object({
  cuit: cuitSchema,
  clave: z.string().min(1, "La clave fiscal es requerida"),
});

export type SaveCredentialsInput = z.infer<typeof saveCredentialsSchema>;
