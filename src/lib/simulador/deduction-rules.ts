import Decimal from "decimal.js";
import { DeductionLimits } from "./tax-tables";

export type SimuladorCategory =
  | "ALQUILER_VIVIENDA"
  | "CUOTAS_MEDICO_ASISTENCIALES"
  | "GASTOS_MEDICOS"
  | "PRIMAS_SEGURO_MUERTE"
  | "DONACIONES"
  | "SERVICIO_DOMESTICO"
  | "INTERESES_HIPOTECARIOS"
  | "HONORARIOS_ASISTENCIA_SANITARIA"
  | "GASTOS_EDUCATIVOS"
  | "GASTOS_SEPELIO";

export interface DeductionInput {
  category: SimuladorCategory;
  annualAmount: Decimal;
}

export interface DeductionResult {
  category: SimuladorCategory;
  label: string;
  inputAmount: Decimal;
  deductibleAmount: Decimal;
  appliedRate: Decimal | null;
  appliedCap: Decimal | null;
  notes: string;
}

export const CATEGORY_LABELS: Record<SimuladorCategory, string> = {
  ALQUILER_VIVIENDA: "Alquiler de vivienda",
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas medico-asistenciales (prepaga)",
  GASTOS_MEDICOS: "Gastos medicos",
  PRIMAS_SEGURO_MUERTE: "Primas de seguro de muerte",
  DONACIONES: "Donaciones",
  SERVICIO_DOMESTICO: "Servicio domestico",
  INTERESES_HIPOTECARIOS: "Intereses hipotecarios",
  HONORARIOS_ASISTENCIA_SANITARIA: "Honorarios asistencia sanitaria",
  GASTOS_EDUCATIVOS: "Gastos educativos",
  GASTOS_SEPELIO: "Gastos de sepelio",
};

export function applyDeductionRules(
  input: DeductionInput,
  limits: DeductionLimits,
  netIncome: Decimal
): DeductionResult {
  const { category, annualAmount } = input;
  let deductible: Decimal;
  let rate: Decimal | null = null;
  let cap: Decimal | null = null;
  let notes = "";

  switch (category) {
    case "ALQUILER_VIVIENDA": {
      const l = limits.alquilerVivienda;
      rate = l.rate;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount.mul(l.rate), l.annualMax);
      notes = `40% del monto, tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "CUOTAS_MEDICO_ASISTENCIALES": {
      const netCap = netIncome.mul(new Decimal("0.05"));
      cap = netCap;
      deductible = Decimal.min(annualAmount, netCap);
      notes = `100% deducible, tope 5% de ganancia neta ($${netCap.toFixed(0)})`;
      break;
    }
    case "GASTOS_MEDICOS": {
      const l = limits.gastosMedicos;
      rate = l.rate;
      const netCap = netIncome.mul(l.netIncomeCapRate);
      cap = netCap;
      const afterRate = annualAmount.mul(l.rate);
      deductible = Decimal.min(afterRate, netCap);
      notes = `40% del monto, tope 5% de ganancia neta ($${netCap.toFixed(0)})`;
      break;
    }
    case "PRIMAS_SEGURO_MUERTE": {
      const l = limits.primasSeguroMuerte;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "DONACIONES": {
      const l = limits.donaciones;
      const netCap = netIncome.mul(l.netIncomeCapRate);
      cap = netCap;
      deductible = Decimal.min(annualAmount, netCap);
      notes = `Tope 5% de ganancia neta ($${netCap.toFixed(0)})`;
      break;
    }
    case "SERVICIO_DOMESTICO": {
      const l = limits.servicioDomestico;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "INTERESES_HIPOTECARIOS": {
      const l = limits.interesesHipotecarios;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "HONORARIOS_ASISTENCIA_SANITARIA": {
      const l = limits.honorariosAsistenciaSanitaria;
      rate = l.rate;
      const netCap = netIncome.mul(l.netIncomeCapRate);
      cap = netCap;
      const afterRate = annualAmount.mul(l.rate);
      deductible = Decimal.min(afterRate, netCap);
      notes = `40% del monto, tope 5% de ganancia neta ($${netCap.toFixed(0)})`;
      break;
    }
    case "GASTOS_EDUCATIVOS": {
      const l = limits.gastosEducativos;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "GASTOS_SEPELIO": {
      const l = limits.gastosSepelio;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    default:
      deductible = new Decimal(0);
      notes = "Categoria no reconocida";
  }

  return {
    category,
    label: CATEGORY_LABELS[category] ?? category,
    inputAmount: annualAmount,
    deductibleAmount: deductible,
    appliedRate: rate,
    appliedCap: cap,
    notes,
  };
}
