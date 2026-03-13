import { describe, it, expect } from "vitest";
import { saveCredentialsSchema } from "@/lib/validators/credentials";

const VALID_CUIT = "20-27395860-7";

describe("saveCredentialsSchema", () => {
  it("should accept valid credentials", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: VALID_CUIT,
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept CUIT without hyphens", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: "20273958607",
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(true);
  });

  it("should strip hyphens from CUIT in the output", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: "20-27395860-7",
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cuit).toBe("20273958607");
    }
  });

  it("should reject missing clave", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: VALID_CUIT,
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty clave", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: VALID_CUIT,
      clave: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const claveError = result.error.issues.find((i) => i.path.includes("clave"));
      expect(claveError).toBeDefined();
      expect(claveError?.message).toBe("La clave fiscal es requerida");
    }
  });

  it("should reject invalid CUIT (wrong check digit)", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: "20-27395860-1",
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject CUIT that is too short", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: "2030495",
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-numeric CUIT", () => {
    const result = saveCredentialsSchema.safeParse({
      cuit: "abcdefghijk",
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing CUIT", () => {
    const result = saveCredentialsSchema.safeParse({
      clave: "miClaveFiscal123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject entirely empty input", () => {
    const result = saveCredentialsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
