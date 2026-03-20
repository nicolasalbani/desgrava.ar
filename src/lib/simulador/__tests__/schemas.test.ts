import { describe, it, expect } from "vitest";
import { simuladorInputSchema, simuladorSimplifiedInputSchema } from "@/lib/simulador/schemas";

describe("simuladorInputSchema", () => {
  describe("valid input", () => {
    it("passes with all required and optional fields", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        tieneHijos: 2,
        tieneConyuge: true,
        incluyeSindicato: true,
        deducciones: [{ category: "GASTOS_MEDICOS", monthlyAmount: 50_000 }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.salarioBrutoMensual).toBe(1_000_000);
        expect(result.data.tieneHijos).toBe(2);
        expect(result.data.tieneConyuge).toBe(true);
        expect(result.data.incluyeSindicato).toBe(true);
        expect(result.data.deducciones).toHaveLength(1);
      }
    });

    it("passes with only the required field (salarioBrutoMensual)", () => {
      const input = { salarioBrutoMensual: 500_000 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("passes with empty deducciones array", () => {
      const input = { salarioBrutoMensual: 500_000, deducciones: [] };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deducciones).toHaveLength(0);
      }
    });

    it("passes with multiple deducciones", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [
          { category: "GASTOS_MEDICOS", monthlyAmount: 10_000 },
          { category: "ALQUILER_VIVIENDA", monthlyAmount: 200_000 },
          { category: "GASTOS_EDUCATIVOS", monthlyAmount: 50_000 },
        ],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deducciones).toHaveLength(3);
      }
    });
  });

  describe("default values", () => {
    it("defaults tieneHijos to 0", () => {
      const input = { salarioBrutoMensual: 1_000_000 };
      const result = simuladorInputSchema.parse(input);
      expect(result.tieneHijos).toBe(0);
    });

    it("defaults tieneConyuge to false", () => {
      const input = { salarioBrutoMensual: 1_000_000 };
      const result = simuladorInputSchema.parse(input);
      expect(result.tieneConyuge).toBe(false);
    });

    it("defaults incluyeSindicato to false", () => {
      const input = { salarioBrutoMensual: 1_000_000 };
      const result = simuladorInputSchema.parse(input);
      expect(result.incluyeSindicato).toBe(false);
    });

    it("defaults deducciones to empty array", () => {
      const input = { salarioBrutoMensual: 1_000_000 };
      const result = simuladorInputSchema.parse(input);
      expect(result.deducciones).toEqual([]);
    });
  });

  describe("missing required fields", () => {
    it("fails when salarioBrutoMensual is missing", () => {
      const input = { tieneHijos: 1 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when deducciones item is missing category", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [{ monthlyAmount: 10_000 }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when deducciones item is missing monthlyAmount", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [{ category: "GASTOS_MEDICOS" }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid types", () => {
    it("fails when salarioBrutoMensual is a string", () => {
      const input = { salarioBrutoMensual: "abc" };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when tieneHijos is a string", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: "two" };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when tieneConyuge is a string", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneConyuge: "yes" };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when incluyeSindicato is a number", () => {
      const input = { salarioBrutoMensual: 1_000_000, incluyeSindicato: 1 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when deducciones is not an array", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: "not-an-array",
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when monthlyAmount is a string", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [{ category: "GASTOS_MEDICOS", monthlyAmount: "abc" }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("boundary values", () => {
    it("fails when salarioBrutoMensual is 0 (must be positive)", () => {
      const input = { salarioBrutoMensual: 0 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when salarioBrutoMensual is negative", () => {
      const input = { salarioBrutoMensual: -1_000 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("passes with very small positive salarioBrutoMensual", () => {
      const input = { salarioBrutoMensual: 0.01 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("passes with very large salarioBrutoMensual", () => {
      const input = { salarioBrutoMensual: 999_999_999 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("tieneHijos min is 0", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: -1 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("tieneHijos max is 20", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: 21 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("tieneHijos accepts 0", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: 0 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("tieneHijos accepts 20", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: 20 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("tieneHijos must be integer", () => {
      const input = { salarioBrutoMensual: 1_000_000, tieneHijos: 1.5 };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when monthlyAmount is 0 (must be positive)", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [{ category: "GASTOS_MEDICOS", monthlyAmount: 0 }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("fails when monthlyAmount is negative", () => {
      const input = {
        salarioBrutoMensual: 1_000_000,
        deducciones: [{ category: "GASTOS_MEDICOS", monthlyAmount: -100 }],
      };
      const result = simuladorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe("simuladorSimplifiedInputSchema", () => {
  it("passes with minimal input (all defaults)", () => {
    const result = simuladorSimplifiedInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tieneHijos).toBe(0);
      expect(result.data.tieneConyuge).toBe(false);
      expect(result.data.esPropietario).toBe(false);
      expect(result.data.interesesHipotecariosMensual).toBe(0);
      expect(result.data.deducciones).toEqual([]);
    }
  });

  it("passes with all fields provided", () => {
    const input = {
      tieneHijos: 3,
      tieneConyuge: true,
      esPropietario: true,
      interesesHipotecariosMensual: 50_000,
      deducciones: [{ category: "ALQUILER_VIVIENDA", amount: 200_000 }],
    };
    const result = simuladorSimplifiedInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails when amount is negative", () => {
    const input = {
      deducciones: [{ category: "GASTOS_MEDICOS", amount: -100 }],
    };
    const result = simuladorSimplifiedInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails when tieneHijos exceeds max", () => {
    const result = simuladorSimplifiedInputSchema.safeParse({ tieneHijos: 21 });
    expect(result.success).toBe(false);
  });

  it("does not require salarioBrutoMensual", () => {
    const result = simuladorSimplifiedInputSchema.safeParse({
      deducciones: [{ category: "GASTOS_MEDICOS", amount: 10_000 }],
    });
    expect(result.success).toBe(true);
  });
});
