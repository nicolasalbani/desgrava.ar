import { describe, it, expect } from "vitest";
import { isDuplicateError } from "@/lib/automation/siradig-navigator";

describe("isDuplicateError", () => {
  it.each([
    "* El comprobante ya fue informado para este período",
    "El comprobante ya fue cargado anteriormente",
    "Ya existe un comprobante con estos datos",
    "Comprobante existente para el mismo proveedor y período",
    "Los datos duplicados no pueden ser ingresados",
    "El comprobante ya se encuentra registrado",
    "Registro duplicado",
  ])('detects duplicate: "%s"', (msg) => {
    expect(isDuplicateError(msg)).toBe(true);
  });

  it.each([
    "El campo monto es obligatorio",
    "Error de validacion desconocido",
    "CUIT inválido",
    "El período seleccionado no es válido",
    "Se detectaron errores en los datos enviados",
    "",
  ])('does not flag non-duplicate error: "%s"', (msg) => {
    expect(isDuplicateError(msg)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDuplicateError("YA FUE INFORMADO")).toBe(true);
    expect(isDuplicateError("Ya Fue Informado")).toBe(true);
  });

  it("detects duplicate in multi-error joined message", () => {
    expect(
      isDuplicateError("Error campo X | El comprobante ya fue informado | Error campo Y"),
    ).toBe(true);
  });
});
