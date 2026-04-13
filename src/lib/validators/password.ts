import { z } from "zod";

export const PASSWORD_RULES = [
  { key: "minLength", label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { key: "uppercase", label: "Una letra mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "Una letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { key: "digit", label: "Un número", test: (p: string) => /[0-9]/.test(p) },
  {
    key: "special",
    label: "Un carácter especial",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

export function checkPasswordRules(password: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const rule of PASSWORD_RULES) {
    result[rule.key] = rule.test(password);
  }
  return result;
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial");

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
