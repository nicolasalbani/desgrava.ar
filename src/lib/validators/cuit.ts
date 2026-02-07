import { z } from "zod";

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function validateCuit(cuit: string): boolean {
  const cleaned = cuit.replace(/-/g, "");
  if (!/^\d{11}$/.test(cleaned)) return false;

  const digits = cleaned.split("").map(Number);
  const checkDigit = digits[10];

  const sum = CUIT_WEIGHTS.reduce(
    (acc, weight, i) => acc + weight * digits[i],
    0
  );

  const remainder = sum % 11;
  let expected: number;

  if (remainder === 0) {
    expected = 0;
  } else if (remainder === 1) {
    expected = 9; // special case for tipo 23
  } else {
    expected = 11 - remainder;
  }

  return checkDigit === expected;
}

export function formatCuit(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 10) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

export const cuitSchema = z
  .string()
  .transform((val) => val.replace(/-/g, ""))
  .refine((val) => /^\d{11}$/.test(val), {
    message: "El CUIT debe tener 11 digitos",
  })
  .refine((val) => validateCuit(val), {
    message: "El CUIT no es valido (digito verificador incorrecto)",
  });
