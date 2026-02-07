import Decimal from "decimal.js";
import { getTaxTables, TaxBracket, TaxPeriod } from "./tax-tables";
import {
  DeductionInput,
  DeductionResult,
  applyDeductionRules,
} from "./deduction-rules";

export interface SimulationInput {
  salarioBrutoMensual: number;
  tieneHijos: number; // count of dependent children
  tieneConyuge: boolean;
  incluyeSindicato: boolean;
  deducciones: Array<{
    category: string;
    monthlyAmount: number;
  }>;
  period?: TaxPeriod;
}

export interface SimulationResult {
  salarioBrutoAnual: string;
  deduccionesMandatorias: string;
  gananciaNetaAnual: string;
  deduccionesPersonales: string;
  deduccionesPorComprobantes: string;
  totalDeducciones: string;
  gananciaImponibleSinDeducciones: string;
  gananciaImponibleConDeducciones: string;
  impuestoSinDeducciones: string;
  impuestoConDeducciones: string;
  ahorroAnual: string;
  ahorroMensual: string;
  tasaEfectivaSin: string;
  tasaEfectivaCon: string;
  detalleDeduciones: Array<{
    category: string;
    label: string;
    inputAmount: string;
    deductibleAmount: string;
    notes: string;
  }>;
}

function calculateTax(taxableIncome: Decimal, brackets: TaxBracket[]): Decimal {
  if (taxableIncome.lte(0)) return new Decimal(0);

  for (const bracket of brackets) {
    if (taxableIncome.lte(bracket.to)) {
      return bracket.fixedAmount.plus(
        taxableIncome.minus(bracket.from).mul(bracket.rate)
      );
    }
  }

  // Above highest bracket
  const last = brackets[brackets.length - 1];
  return last.fixedAmount.plus(taxableIncome.minus(last.from).mul(last.rate));
}

export function simulate(input: SimulationInput): SimulationResult {
  const tables = getTaxTables(input.period);
  const pd = tables.personalDeductions;
  const rates = tables.mandatoryRates;

  // 1. Annual gross salary
  const brutoAnual = new Decimal(input.salarioBrutoMensual).mul(13); // 12 months + aguinaldo

  // 2. Mandatory deductions (employee contributions)
  let mandatoryRate = rates.jubilacion.plus(rates.obraSocial).plus(rates.ley19032);
  if (input.incluyeSindicato) {
    mandatoryRate = mandatoryRate.plus(rates.sindicato);
  }
  const mandatorias = brutoAnual.mul(mandatoryRate);

  // 3. Net income (after mandatory deductions)
  const netaAnual = brutoAnual.minus(mandatorias);

  // 4. Personal deductions
  let personales = pd.gananciaNoImponible.plus(pd.deduccionEspecial);
  if (input.tieneConyuge) {
    personales = personales.plus(pd.conyuge);
  }
  personales = personales.plus(pd.hijoMenor.mul(input.tieneHijos));

  // 5. Apply deduction rules for each invoice-backed deduction
  const deductionInputs: DeductionInput[] = input.deducciones.map((d) => ({
    category: d.category as DeductionInput["category"],
    annualAmount: new Decimal(d.monthlyAmount).mul(12),
  }));

  const deductionResults: DeductionResult[] = deductionInputs.map((di) =>
    applyDeductionRules(di, tables.deductionLimits, netaAnual)
  );

  const totalComprobantes = deductionResults.reduce(
    (sum, r) => sum.plus(r.deductibleAmount),
    new Decimal(0)
  );

  // 6. Taxable income WITHOUT invoice deductions (baseline)
  const imponibleSin = Decimal.max(netaAnual.minus(personales), new Decimal(0));

  // 7. Taxable income WITH invoice deductions
  const imponibleCon = Decimal.max(
    netaAnual.minus(personales).minus(totalComprobantes),
    new Decimal(0)
  );

  // 8. Tax calculation
  const impuestoSin = calculateTax(imponibleSin, tables.brackets);
  const impuestoCon = calculateTax(imponibleCon, tables.brackets);

  // 9. Savings
  const ahorroAnual = impuestoSin.minus(impuestoCon);
  const ahorroMensual = ahorroAnual.div(12);

  const tasaEfectivaSin = brutoAnual.gt(0)
    ? impuestoSin.div(brutoAnual).mul(100)
    : new Decimal(0);
  const tasaEfectivaCon = brutoAnual.gt(0)
    ? impuestoCon.div(brutoAnual).mul(100)
    : new Decimal(0);

  return {
    salarioBrutoAnual: brutoAnual.toFixed(2),
    deduccionesMandatorias: mandatorias.toFixed(2),
    gananciaNetaAnual: netaAnual.toFixed(2),
    deduccionesPersonales: personales.toFixed(2),
    deduccionesPorComprobantes: totalComprobantes.toFixed(2),
    totalDeducciones: personales.plus(totalComprobantes).toFixed(2),
    gananciaImponibleSinDeducciones: imponibleSin.toFixed(2),
    gananciaImponibleConDeducciones: imponibleCon.toFixed(2),
    impuestoSinDeducciones: impuestoSin.toFixed(2),
    impuestoConDeducciones: impuestoCon.toFixed(2),
    ahorroAnual: ahorroAnual.toFixed(2),
    ahorroMensual: ahorroMensual.toFixed(2),
    tasaEfectivaSin: tasaEfectivaSin.toFixed(2),
    tasaEfectivaCon: tasaEfectivaCon.toFixed(2),
    detalleDeduciones: deductionResults.map((r) => ({
      category: r.category,
      label: r.label,
      inputAmount: r.inputAmount.toFixed(2),
      deductibleAmount: r.deductibleAmount.toFixed(2),
      notes: r.notes,
    })),
  };
}
