import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  applyDeductionRules,
  DeductionInput,
  SimuladorCategory,
  CATEGORY_LABELS,
} from "@/lib/simulador/deduction-rules";
import { getTaxTables } from "@/lib/simulador/tax-tables";

const tables = getTaxTables("2025");
const limits = tables.deductionLimits;
const netIncome = new Decimal("10_000_000"); // 10M net income for tests

function applyRule(category: SimuladorCategory, annualAmount: number, net: Decimal = netIncome) {
  const input: DeductionInput = {
    category,
    annualAmount: new Decimal(annualAmount),
  };
  return applyDeductionRules(input, limits, net);
}

describe("applyDeductionRules()", () => {
  describe("CUOTAS_MEDICO_ASISTENCIALES - 100% with 5% net income cap", () => {
    it("deducts full amount when under the cap", () => {
      const cap = netIncome.mul("0.05"); // 500,000
      const result = applyRule("CUOTAS_MEDICO_ASISTENCIALES", 100_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("100000.00");
      expect(result.appliedCap?.toFixed(2)).toBe(cap.toFixed(2));
    });

    it("caps at 5% of net income when amount exceeds cap", () => {
      const cap = netIncome.mul("0.05"); // 500,000
      const result = applyRule("CUOTAS_MEDICO_ASISTENCIALES", 1_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(cap.toFixed(2));
    });

    it("has no rate applied (null)", () => {
      const result = applyRule("CUOTAS_MEDICO_ASISTENCIALES", 100_000);
      expect(result.appliedRate).toBeNull();
    });
  });

  describe("PRIMAS_SEGURO_MUERTE - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("PRIMAS_SEGURO_MUERTE", 10_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("10000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("PRIMAS_SEGURO_MUERTE", 100_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(
        limits.primasSeguroMuerte.annualMax.toFixed(2),
      );
    });

    it("returns correct label", () => {
      const result = applyRule("PRIMAS_SEGURO_MUERTE", 10_000);
      expect(result.label).toBe(CATEGORY_LABELS.PRIMAS_SEGURO_MUERTE);
    });
  });

  describe("PRIMAS_AHORRO_SEGUROS_MIXTOS - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("PRIMAS_AHORRO_SEGUROS_MIXTOS", 10_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("10000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("PRIMAS_AHORRO_SEGUROS_MIXTOS", 100_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(
        limits.primasAhorroSegurosMixtos.annualMax.toFixed(2),
      );
    });
  });

  describe("APORTES_RETIRO_PRIVADO - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("APORTES_RETIRO_PRIVADO", 20_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("20000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("APORTES_RETIRO_PRIVADO", 100_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(
        limits.aportesRetiroPrivado.annualMax.toFixed(2),
      );
    });
  });

  describe("DONACIONES - 5% net income cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("DONACIONES", 100_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("100000.00");
    });

    it("caps at 5% of net income", () => {
      const cap = netIncome.mul("0.05");
      const result = applyRule("DONACIONES", 1_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(cap.toFixed(2));
    });
  });

  describe("INTERESES_HIPOTECARIOS - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("INTERESES_HIPOTECARIOS", 10_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("10000.00");
    });

    it("caps at annual max ($20,000)", () => {
      const result = applyRule("INTERESES_HIPOTECARIOS", 50_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("20000.00");
    });
  });

  describe("GASTOS_SEPELIO - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("GASTOS_SEPELIO", 500_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("500000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("GASTOS_SEPELIO", 2_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(limits.gastosSepelio.annualMax.toFixed(2));
    });
  });

  describe("GASTOS_MEDICOS - 40% rate with 5% net income cap", () => {
    it("applies 40% rate and stays under cap", () => {
      const result = applyRule("GASTOS_MEDICOS", 100_000);
      // 100_000 * 0.40 = 40_000
      expect(result.deductibleAmount.toFixed(2)).toBe("40000.00");
      expect(result.appliedRate?.toFixed(2)).toBe("0.40");
    });

    it("caps at 5% of net income when 40% of amount exceeds cap", () => {
      const cap = netIncome.mul("0.05"); // 500,000
      // Need 40% of amount > 500,000, so amount > 1,250,000
      const result = applyRule("GASTOS_MEDICOS", 2_000_000);
      // 2,000,000 * 0.40 = 800,000 > 500,000 cap
      expect(result.deductibleAmount.toFixed(2)).toBe(cap.toFixed(2));
    });

    it("rate is applied before cap comparison", () => {
      // Amount where 40% is exactly under cap
      const cap = netIncome.mul("0.05"); // 500,000
      const amountAt40 = cap.div("0.40"); // 1,250,000
      const result = applyRule("GASTOS_MEDICOS", amountAt40.toNumber());
      expect(result.deductibleAmount.toFixed(2)).toBe(cap.toFixed(2));
    });
  });

  describe("GASTOS_INDUMENTARIA_TRABAJO - 100% deductible", () => {
    it("deducts full amount", () => {
      const result = applyRule("GASTOS_INDUMENTARIA_TRABAJO", 500_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("500000.00");
    });

    it("has no rate or cap", () => {
      const result = applyRule("GASTOS_INDUMENTARIA_TRABAJO", 500_000);
      expect(result.appliedRate).toBeNull();
      expect(result.appliedCap).toBeNull();
    });

    it("notes say 100% deducible", () => {
      const result = applyRule("GASTOS_INDUMENTARIA_TRABAJO", 500_000);
      expect(result.notes).toBe("100% deducible");
    });
  });

  describe("ALQUILER_VIVIENDA - 40% rate with annual max cap", () => {
    it("applies 40% rate when under cap", () => {
      const result = applyRule("ALQUILER_VIVIENDA", 1_000_000);
      // 1,000,000 * 0.40 = 400,000
      expect(result.deductibleAmount.toFixed(2)).toBe("400000.00");
    });

    it("caps at annual max when 40% exceeds it", () => {
      const cap = limits.alquilerVivienda.annualMax;
      // Need 40% of amount > cap. cap = 3,091,035, so amount > 7,727,587.5
      const result = applyRule("ALQUILER_VIVIENDA", 10_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(cap.toFixed(2));
    });

    it("has rate 0.40 and cap set", () => {
      const result = applyRule("ALQUILER_VIVIENDA", 1_000_000);
      expect(result.appliedRate?.toFixed(2)).toBe("0.40");
      expect(result.appliedCap?.toFixed(2)).toBe(limits.alquilerVivienda.annualMax.toFixed(2));
    });
  });

  describe("SERVICIO_DOMESTICO - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("SERVICIO_DOMESTICO", 1_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("1000000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("SERVICIO_DOMESTICO", 5_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(
        limits.servicioDomestico.annualMax.toFixed(2),
      );
    });
  });

  describe("100% deductible categories (no cap)", () => {
    const fullCategories: SimuladorCategory[] = [
      "APORTE_SGR",
      "VEHICULOS_CORREDORES",
      "INTERESES_CORREDORES",
      "OTRAS_DEDUCCIONES",
    ];

    for (const cat of fullCategories) {
      it(`${cat} deducts 100% of the amount`, () => {
        const result = applyRule(cat, 1_000_000);
        expect(result.deductibleAmount.toFixed(2)).toBe("1000000.00");
      });

      it(`${cat} has no rate or cap`, () => {
        const result = applyRule(cat, 1_000_000);
        expect(result.appliedRate).toBeNull();
        expect(result.appliedCap).toBeNull();
      });
    }
  });

  describe("GASTOS_EDUCATIVOS - annual max cap", () => {
    it("deducts full amount when under the cap", () => {
      const result = applyRule("GASTOS_EDUCATIVOS", 500_000);
      expect(result.deductibleAmount.toFixed(2)).toBe("500000.00");
    });

    it("caps at annual max", () => {
      const result = applyRule("GASTOS_EDUCATIVOS", 2_000_000);
      expect(result.deductibleAmount.toFixed(2)).toBe(limits.gastosEducativos.annualMax.toFixed(2));
    });
  });

  describe("zero amounts", () => {
    it("returns zero deductible for zero annual amount", () => {
      const input: DeductionInput = {
        category: "GASTOS_MEDICOS",
        annualAmount: new Decimal(0),
      };
      const result = applyDeductionRules(input, limits, netIncome);
      expect(result.deductibleAmount.toFixed(2)).toBe("0.00");
    });

    it("returns zero deductible for zero amount on capped category", () => {
      const input: DeductionInput = {
        category: "PRIMAS_SEGURO_MUERTE",
        annualAmount: new Decimal(0),
      };
      const result = applyDeductionRules(input, limits, netIncome);
      expect(result.deductibleAmount.toFixed(2)).toBe("0.00");
    });

    it("returns zero deductible for 100% category with zero amount", () => {
      const input: DeductionInput = {
        category: "GASTOS_INDUMENTARIA_TRABAJO",
        annualAmount: new Decimal(0),
      };
      const result = applyDeductionRules(input, limits, netIncome);
      expect(result.deductibleAmount.toFixed(2)).toBe("0.00");
    });
  });

  describe("labels", () => {
    it("returns correct label for each category", () => {
      const categories = Object.keys(CATEGORY_LABELS) as SimuladorCategory[];
      for (const cat of categories) {
        const result = applyRule(cat, 1000);
        expect(result.label).toBe(CATEGORY_LABELS[cat]);
      }
    });
  });

  describe("net income cap changes with net income", () => {
    it("5% cap is lower with lower net income", () => {
      const lowNet = new Decimal("1_000_000");
      const highNet = new Decimal("20_000_000");
      const lowResult = applyRule("CUOTAS_MEDICO_ASISTENCIALES", 5_000_000, lowNet);
      const highResult = applyRule("CUOTAS_MEDICO_ASISTENCIALES", 5_000_000, highNet);
      expect(lowResult.deductibleAmount.lt(highResult.deductibleAmount)).toBe(true);
    });
  });
});
