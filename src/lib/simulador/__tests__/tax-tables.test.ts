import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { getTaxTables, TAX_TABLES_2025, CURRENT_PERIOD } from "@/lib/simulador/tax-tables";

describe("getTaxTables()", () => {
  it("returns tables for the default period", () => {
    const tables = getTaxTables();
    expect(tables).toBe(TAX_TABLES_2025);
  });

  it("returns 2025 tables when explicitly requested", () => {
    const tables = getTaxTables("2025");
    expect(tables).toBe(TAX_TABLES_2025);
  });

  it("CURRENT_PERIOD is 2025", () => {
    expect(CURRENT_PERIOD).toBe("2025");
  });

  describe("brackets", () => {
    const tables = getTaxTables("2025");
    const brackets = tables.brackets;

    it("has 9 tax brackets", () => {
      expect(brackets).toHaveLength(9);
    });

    it("brackets are ordered by ascending 'from' value", () => {
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].from.gt(brackets[i - 1].from)).toBe(true);
      }
    });

    it("each bracket 'to' equals next bracket 'from' (continuous)", () => {
      for (let i = 0; i < brackets.length - 1; i++) {
        expect(brackets[i].to.eq(brackets[i + 1].from)).toBe(true);
      }
    });

    it("first bracket starts at 0", () => {
      expect(brackets[0].from.eq(0)).toBe(true);
    });

    it("first bracket has zero fixed amount", () => {
      expect(brackets[0].fixedAmount.eq(0)).toBe(true);
    });

    it("last bracket goes to Infinity", () => {
      expect(brackets[brackets.length - 1].to.eq(Infinity)).toBe(true);
    });

    it("rates increase across brackets", () => {
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].rate.gte(brackets[i - 1].rate)).toBe(true);
      }
    });

    it("rates range from 5% to 35%", () => {
      expect(brackets[0].rate.eq("0.05")).toBe(true);
      expect(brackets[brackets.length - 1].rate.eq("0.35")).toBe(true);
    });

    it("fixed amounts are non-negative and non-decreasing", () => {
      for (let i = 0; i < brackets.length; i++) {
        expect(brackets[i].fixedAmount.gte(0)).toBe(true);
        if (i > 0) {
          expect(brackets[i].fixedAmount.gte(brackets[i - 1].fixedAmount)).toBe(true);
        }
      }
    });
  });

  describe("personal deductions", () => {
    const pd = getTaxTables("2025").personalDeductions;

    it("gananciaNoImponible is positive", () => {
      expect(pd.gananciaNoImponible.gt(0)).toBe(true);
    });

    it("deduccionEspecial is positive", () => {
      expect(pd.deduccionEspecial.gt(0)).toBe(true);
    });

    it("conyuge is positive", () => {
      expect(pd.conyuge.gt(0)).toBe(true);
    });

    it("hijoMenor is positive", () => {
      expect(pd.hijoMenor.gt(0)).toBe(true);
    });

    it("deduccionEspecial is greater than gananciaNoImponible", () => {
      expect(pd.deduccionEspecial.gt(pd.gananciaNoImponible)).toBe(true);
    });

    it("has correct 2025 values", () => {
      expect(pd.gananciaNoImponible.toFixed(2)).toBe("3091035.00");
      expect(pd.deduccionEspecial.toFixed(2)).toBe("14836968.00");
      expect(pd.conyuge.toFixed(2)).toBe("2911135.00");
      expect(pd.hijoMenor.toFixed(2)).toBe("1468096.00");
    });
  });

  describe("deduction limits", () => {
    const dl = getTaxTables("2025").deductionLimits;

    it("cuotasMedicoAsistenciales has 5% net income cap rate", () => {
      expect(dl.cuotasMedicoAsistenciales.netIncomeCapRate.eq("0.05")).toBe(true);
    });

    it("primasSeguroMuerte has positive annual max", () => {
      expect(dl.primasSeguroMuerte.annualMax.gt(0)).toBe(true);
    });

    it("gastosMedicos has 40% rate and 5% net income cap", () => {
      expect(dl.gastosMedicos.rate.eq("0.40")).toBe(true);
      expect(dl.gastosMedicos.netIncomeCapRate.eq("0.05")).toBe(true);
    });

    it("alquilerVivienda has 40% rate and positive annual max", () => {
      expect(dl.alquilerVivienda.rate.eq("0.40")).toBe(true);
      expect(dl.alquilerVivienda.annualMax.gt(0)).toBe(true);
    });

    it("interesesHipotecarios has annual max of 20000", () => {
      expect(dl.interesesHipotecarios.annualMax.eq("20000")).toBe(true);
    });

    it("gastosEducativos has positive annual max", () => {
      expect(dl.gastosEducativos.annualMax.gt(0)).toBe(true);
    });

    it("donaciones has 5% net income cap rate", () => {
      expect(dl.donaciones.netIncomeCapRate.eq("0.05")).toBe(true);
    });
  });

  describe("mandatory rates", () => {
    const rates = getTaxTables("2025").mandatoryRates;

    it("jubilacion is 11%", () => {
      expect(rates.jubilacion.eq("0.11")).toBe(true);
    });

    it("obraSocial is 3%", () => {
      expect(rates.obraSocial.eq("0.03")).toBe(true);
    });

    it("ley19032 (PAMI) is 3%", () => {
      expect(rates.ley19032.eq("0.03")).toBe(true);
    });

    it("sindicato is 2%", () => {
      expect(rates.sindicato.eq("0.02")).toBe(true);
    });

    it("total mandatory rate without sindicato is 17%", () => {
      const total = rates.jubilacion.plus(rates.obraSocial).plus(rates.ley19032);
      expect(total.eq("0.17")).toBe(true);
    });

    it("total mandatory rate with sindicato is 19%", () => {
      const total = rates.jubilacion
        .plus(rates.obraSocial)
        .plus(rates.ley19032)
        .plus(rates.sindicato);
      expect(total.eq("0.19")).toBe(true);
    });
  });
});
