import Decimal from "decimal.js";

export interface TaxBracket {
  from: Decimal;
  to: Decimal;
  fixedAmount: Decimal;
  rate: Decimal; // 0.05 to 0.35
}

export interface PersonalDeductions {
  gananciaNoImponible: Decimal; // Art. 30 a) Minimum non-taxable income
  deduccionEspecial: Decimal; // Art. 30 c) Special deduction for employees
  conyuge: Decimal; // Art. 30 b) Spouse deduction
  hijoMenor: Decimal; // Per dependent child
}

export interface DeductionLimits {
  alquilerVivienda: { rate: Decimal; annualMax: Decimal };
  cuotasMedicoAsistenciales: { rate: Decimal }; // 5% of net income cap
  gastosMedicos: { rate: Decimal; netIncomeCapRate: Decimal };
  primasSeguroMuerte: { annualMax: Decimal };
  donaciones: { netIncomeCapRate: Decimal };
  servicioDomestico: { annualMax: Decimal };
  interesesHipotecarios: { annualMax: Decimal };
  honorariosAsistenciaSanitaria: { rate: Decimal; netIncomeCapRate: Decimal };
  gastosEducativos: { annualMax: Decimal };
  gastosSepelio: { annualMax: Decimal };
}

// Period 2025 (fiscal year 2025, applicable for SiRADIG filings)
// Values based on RG ARCA / tables updated periodically
// These are ANNUAL values

export const TAX_TABLES_2025 = {
  personalDeductions: {
    gananciaNoImponible: new Decimal("3_091_035.00"),
    deduccionEspecial: new Decimal("14_836_968.00"),
    conyuge: new Decimal("2_911_135.00"),
    hijoMenor: new Decimal("1_468_096.00"),
  } satisfies PersonalDeductions,

  brackets: [
    { from: new Decimal(0), to: new Decimal("1_163_862.77"), fixedAmount: new Decimal(0), rate: new Decimal("0.05") },
    { from: new Decimal("1_163_862.77"), to: new Decimal("2_327_725.53"), fixedAmount: new Decimal("58_193.14"), rate: new Decimal("0.09") },
    { from: new Decimal("2_327_725.53"), to: new Decimal("3_491_588.30"), fixedAmount: new Decimal("162_940.86"), rate: new Decimal("0.12") },
    { from: new Decimal("3_491_588.30"), to: new Decimal("4_655_451.07"), fixedAmount: new Decimal("302_604.39"), rate: new Decimal("0.15") },
    { from: new Decimal("4_655_451.07"), to: new Decimal("6_983_176.60"), fixedAmount: new Decimal("477_183.80"), rate: new Decimal("0.19") },
    { from: new Decimal("6_983_176.60"), to: new Decimal("9_310_902.13"), fixedAmount: new Decimal("919_451.65"), rate: new Decimal("0.23") },
    { from: new Decimal("9_310_902.13"), to: new Decimal("13_966_353.20"), fixedAmount: new Decimal("1_454_878.92"), rate: new Decimal("0.27") },
    { from: new Decimal("13_966_353.20"), to: new Decimal("18_621_804.27"), fixedAmount: new Decimal("2_711_860.82"), rate: new Decimal("0.31") },
    { from: new Decimal("18_621_804.27"), to: new Decimal(Infinity), fixedAmount: new Decimal("4_154_049.65"), rate: new Decimal("0.35") },
  ] satisfies TaxBracket[],

  deductionLimits: {
    alquilerVivienda: { rate: new Decimal("0.40"), annualMax: new Decimal("3_091_035.00") },
    cuotasMedicoAsistenciales: { rate: new Decimal("1.00") }, // 100% deductible, but capped at 5% of net income
    gastosMedicos: { rate: new Decimal("0.40"), netIncomeCapRate: new Decimal("0.05") },
    primasSeguroMuerte: { annualMax: new Decimal("42_921.24") },
    donaciones: { netIncomeCapRate: new Decimal("0.05") },
    servicioDomestico: { annualMax: new Decimal("3_091_035.00") },
    interesesHipotecarios: { annualMax: new Decimal("20_000.00") },
    honorariosAsistenciaSanitaria: { rate: new Decimal("0.40"), netIncomeCapRate: new Decimal("0.05") },
    gastosEducativos: { annualMax: new Decimal("1_163_862.77") },
    gastosSepelio: { annualMax: new Decimal("996_920.00") },
  } satisfies DeductionLimits,

  // Mandatory deductions rates (employee contributions)
  mandatoryRates: {
    jubilacion: new Decimal("0.11"),
    obraSocial: new Decimal("0.03"),
    ley19032: new Decimal("0.03"), // PAMI
    sindicato: new Decimal("0.02"), // optional, common
  },
};

export type TaxPeriod = "2025";
export const CURRENT_PERIOD: TaxPeriod = "2025";

export function getTaxTables(period: TaxPeriod = CURRENT_PERIOD) {
  switch (period) {
    case "2025":
      return TAX_TABLES_2025;
    default:
      return TAX_TABLES_2025;
  }
}
