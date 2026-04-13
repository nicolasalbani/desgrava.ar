import { z } from "zod";

const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

export const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, "El nombre no puede estar vacío")
      .max(100, "El nombre no puede superar los 100 caracteres")
      .optional(),
    image: z
      .string()
      .refine((val) => val.startsWith("data:image/"), {
        message: "La imagen debe ser un data URL válido",
      })
      .refine((val) => Buffer.byteLength(val, "utf8") <= MAX_IMAGE_SIZE, {
        message: "La imagen no puede superar los 500KB",
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.image !== undefined, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
