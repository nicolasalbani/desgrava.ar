import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { simulate, SimulationInput } from "@/lib/simulador/calculator";
import { getTaxTables } from "@/lib/simulador/tax-tables";

function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    salarioBrutoMensual: 1_000_000,
    tieneHijos: 0,
    tieneConyuge: false,
    incluyeSindicato: false,
    deducciones: [],
    ...overrides,
  };
}

describe("simulate()", () => {
  describe("basic simulation with salary only (no deductions)", () => {
    it("calculates annual gross as monthly * 13 (12 months + aguinaldo)", () => {
      const result = simulate(makeInput({ salarioBrutoMensual: 1_000_000 }));
      expect(result.salarioBrutoAnual).toBe("13000000.00");
    });

    it("calculates mandatory deductions without sindicato", () => {
      const result = simulate(
        makeInput({ salarioBrutoMensual: 1_000_000, incluyeSindicato: false }),
      );
      // mandatory rate = 0.11 + 0.03 + 0.03 = 0.17
      const expected = new Decimal(13_000_000).mul("0.17");
      expect(result.deduccionesMandatorias).toBe(expected.toFixed(2));
    });

    it("calculates mandatory deductions with sindicato", () => {
      const result = simulate(
        makeInput({ salarioBrutoMensual: 1_000_000, incluyeSindicato: true }),
      );
      // mandatory rate = 0.11 + 0.03 + 0.03 + 0.02 = 0.19
      const expected = new Decimal(13_000_000).mul("0.19");
      expect(result.deduccionesMandatorias).toBe(expected.toFixed(2));
    });

    it("calculates net annual income as gross minus mandatory", () => {
      const result = simulate(makeInput({ salarioBrutoMensual: 1_000_000 }));
      const gross = new Decimal("13000000");
      const mandatory = gross.mul("0.17");
      expect(result.gananciaNetaAnual).toBe(gross.minus(mandatory).toFixed(2));
    });

    it("has zero comprobantes deductions when no deducciones provided", () => {
      const result = simulate(makeInput());
      expect(result.deduccionesPorComprobantes).toBe("0.00");
    });

    it("has empty detalleDeduciones when no deducciones provided", () => {
      const result = simulate(makeInput());
      expect(result.detalleDeduciones).toHaveLength(0);
    });

    it("computes savings as zero when there are no invoice deductions", () => {
      const result = simulate(makeInput());
      expect(result.ahorroAnual).toBe("0.00");
      expect(result.ahorroMensual).toBe("0.00");
    });
  });

  describe("simulation with various deduction categories", () => {
    it("applies a single deduction and produces positive savings", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 2_000_000,
          deducciones: [{ category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 50_000 }],
        }),
      );
      expect(parseFloat(result.ahorroAnual)).toBeGreaterThan(0);
      expect(result.detalleDeduciones).toHaveLength(1);
      expect(result.detalleDeduciones[0].category).toBe("GASTOS_INDUMENTARIA_TRABAJO");
    });

    it("applies multiple deductions and accumulates them", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 2_000_000,
          deducciones: [
            { category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 50_000 },
            { category: "APORTE_SGR", monthlyAmount: 30_000 },
          ],
        }),
      );
      expect(result.detalleDeduciones).toHaveLength(2);
      // Total comprobantes = 50000*12 + 30000*12 = 960000
      expect(result.deduccionesPorComprobantes).toBe("960000.00");
    });

    it("converts monthly deduction amounts to annual (x12)", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 2_000_000,
          deducciones: [{ category: "OTRAS_DEDUCCIONES", monthlyAmount: 100_000 }],
        }),
      );
      expect(result.detalleDeduciones[0].inputAmount).toBe("1200000.00");
    });
  });

  describe("dependent deductions (conyuge, hijos)", () => {
    it("adds conyuge deduction to personal deductions", () => {
      const tables = getTaxTables("2025");
      const pd = tables.personalDeductions;
      const withConyuge = simulate(makeInput({ tieneConyuge: true }));
      const without = simulate(makeInput({ tieneConyuge: false }));

      const diff = new Decimal(withConyuge.deduccionesPersonales).minus(
        without.deduccionesPersonales,
      );
      expect(diff.toFixed(2)).toBe(pd.conyuge.toFixed(2));
    });

    it("adds per-child deduction to personal deductions", () => {
      const tables = getTaxTables("2025");
      const pd = tables.personalDeductions;
      const with2 = simulate(makeInput({ tieneHijos: 2 }));
      const with0 = simulate(makeInput({ tieneHijos: 0 }));

      const diff = new Decimal(with2.deduccionesPersonales).minus(with0.deduccionesPersonales);
      expect(diff.toFixed(2)).toBe(pd.hijoMenor.mul(2).toFixed(2));
    });

    it("includes base personal deductions (gananciaNoImponible + deduccionEspecial)", () => {
      const tables = getTaxTables("2025");
      const pd = tables.personalDeductions;
      const result = simulate(makeInput({ tieneHijos: 0, tieneConyuge: false }));
      const expected = pd.gananciaNoImponible.plus(pd.deduccionEspecial);
      expect(result.deduccionesPersonales).toBe(expected.toFixed(2));
    });
  });

  describe("tax bracket boundary conditions", () => {
    it("taxes income at the boundary of first bracket correctly", () => {
      // We need taxable income exactly at first bracket boundary
      // This is an indirect test - we verify the tax output is consistent
      const tables = getTaxTables("2025");
      const firstBracketTo = tables.brackets[0].to; // 1_163_862.77
      // Tax should be firstBracketTo * 0.05
      const expectedTax = firstBracketTo.mul("0.05");

      // Create input that results in taxable income = firstBracketTo
      // taxable = netAnual - personales
      // We need to reverse-engineer the salary
      const pd = tables.personalDeductions;
      const personales = pd.gananciaNoImponible.plus(pd.deduccionEspecial);
      const targetNet = firstBracketTo.plus(personales);
      // netAnual = brutoAnual * (1 - 0.17), brutoAnual = salary * 13
      const brutoAnual = targetNet.div(new Decimal(1).minus("0.17"));
      const salary = brutoAnual.div(13);

      const result = simulate(makeInput({ salarioBrutoMensual: salary.toNumber() }));
      expect(result.impuestoSinDeducciones).toBe(expectedTax.toFixed(2));
    });

    it("correctly applies second bracket rate for income just above first bracket", () => {
      const tables = getTaxTables("2025");
      const b1 = tables.brackets[0];
      const b2 = tables.brackets[1];

      // taxable income = first bracket to + 100_000
      const taxable = b1.to.plus(100_000);
      // Expected tax: b2.fixedAmount + (taxable - b2.from) * b2.rate
      const expectedTax = b2.fixedAmount.plus(taxable.minus(b2.from).mul(b2.rate));

      const pd = tables.personalDeductions;
      const personales = pd.gananciaNoImponible.plus(pd.deduccionEspecial);
      const targetNet = taxable.plus(personales);
      const brutoAnual = targetNet.div(new Decimal(1).minus("0.17"));
      const salary = brutoAnual.div(13);

      const result = simulate(makeInput({ salarioBrutoMensual: salary.toNumber() }));
      expect(result.impuestoSinDeducciones).toBe(expectedTax.toFixed(2));
    });
  });

  describe("progressive tax calculation correctness", () => {
    it("tax increases as salary increases", () => {
      const low = simulate(makeInput({ salarioBrutoMensual: 2_000_000 }));
      const high = simulate(makeInput({ salarioBrutoMensual: 4_000_000 }));
      expect(parseFloat(high.impuestoSinDeducciones)).toBeGreaterThan(
        parseFloat(low.impuestoSinDeducciones),
      );
    });

    it("effective tax rate increases with higher income", () => {
      const low = simulate(makeInput({ salarioBrutoMensual: 2_000_000 }));
      const high = simulate(makeInput({ salarioBrutoMensual: 10_000_000 }));
      expect(parseFloat(high.tasaEfectivaSin)).toBeGreaterThan(parseFloat(low.tasaEfectivaSin));
    });

    it("savings from deductions increase with higher marginal rate", () => {
      const deductions = [{ category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 100_000 }];
      const low = simulate(makeInput({ salarioBrutoMensual: 2_000_000, deducciones: deductions }));
      const high = simulate(
        makeInput({ salarioBrutoMensual: 10_000_000, deducciones: deductions }),
      );
      // Higher income means higher marginal rate, so same deduction saves more
      expect(parseFloat(high.ahorroAnual)).toBeGreaterThan(parseFloat(low.ahorroAnual));
    });
  });

  describe("zero salary edge case", () => {
    it("handles near-zero salary gracefully", () => {
      const result = simulate(makeInput({ salarioBrutoMensual: 0.01 }));
      expect(result.salarioBrutoAnual).toBe("0.13");
      expect(result.impuestoSinDeducciones).toBe("0.00");
      expect(result.impuestoConDeducciones).toBe("0.00");
      expect(result.ahorroAnual).toBe("0.00");
      expect(result.tasaEfectivaSin).toBe("0.00");
    });
  });

  describe("very high salary", () => {
    it("applies the highest bracket rate (35%)", () => {
      const result = simulate(makeInput({ salarioBrutoMensual: 50_000_000 }));
      // With 50M monthly, taxable income is well above the highest bracket
      expect(parseFloat(result.impuestoSinDeducciones)).toBeGreaterThan(0);
      // Effective rate should approach 35% but less due to progressive structure
      expect(parseFloat(result.tasaEfectivaSin)).toBeGreaterThan(20);
      expect(parseFloat(result.tasaEfectivaSin)).toBeLessThan(35);
    });

    it("taxable income is never negative", () => {
      const result = simulate(makeInput({ salarioBrutoMensual: 50_000_000 }));
      expect(parseFloat(result.gananciaImponibleSinDeducciones)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(result.gananciaImponibleConDeducciones)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("effective tax rates", () => {
    it("effective rate with deductions is less than or equal to rate without", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 3_000_000,
          deducciones: [{ category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 100_000 }],
        }),
      );
      expect(parseFloat(result.tasaEfectivaCon)).toBeLessThanOrEqual(
        parseFloat(result.tasaEfectivaSin),
      );
    });
  });

  describe("totalDeducciones", () => {
    it("equals personal deductions plus comprobantes deductions", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 3_000_000,
          tieneConyuge: true,
          tieneHijos: 2,
          deducciones: [{ category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 100_000 }],
        }),
      );
      const expected = new Decimal(result.deduccionesPersonales).plus(
        result.deduccionesPorComprobantes,
      );
      expect(result.totalDeducciones).toBe(expected.toFixed(2));
    });
  });

  describe("ahorroMensual", () => {
    it("equals ahorroAnual divided by 12", () => {
      const result = simulate(
        makeInput({
          salarioBrutoMensual: 3_000_000,
          deducciones: [{ category: "GASTOS_INDUMENTARIA_TRABAJO", monthlyAmount: 100_000 }],
        }),
      );
      const expected = new Decimal(result.ahorroAnual).div(12);
      expect(result.ahorroMensual).toBe(expected.toFixed(2));
    });
  });
});
