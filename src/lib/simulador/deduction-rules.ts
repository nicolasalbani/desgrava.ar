import Decimal from "decimal.js";
import { DeductionLimits } from "./tax-tables";

export type SimuladorCategory =
  | "CUOTAS_MEDICO_ASISTENCIALES"
  | "PRIMAS_SEGURO_MUERTE"
  | "PRIMAS_AHORRO_SEGUROS_MIXTOS"
  | "APORTES_RETIRO_PRIVADO"
  | "DONACIONES"
  | "INTERESES_HIPOTECARIOS"
  | "GASTOS_SEPELIO"
  | "GASTOS_MEDICOS"
  | "GASTOS_INDUMENTARIA_TRABAJO"
  | "ALQUILER_VIVIENDA"
  | "SERVICIO_DOMESTICO"
  | "APORTE_SGR"
  | "VEHICULOS_CORREDORES"
  | "INTERESES_CORREDORES"
  | "GASTOS_EDUCATIVOS"
  | "OTRAS_DEDUCCIONES";

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
  CUOTAS_MEDICO_ASISTENCIALES: "Cuotas Médico-Asistenciales",
  PRIMAS_SEGURO_MUERTE: "Primas de Seguro para el caso de muerte/riesgo de muerte",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "Primas de Ahorro correspondientes a Seguros Mixtos",
  APORTES_RETIRO_PRIVADO: "Aportes correspondientes a Planes de Seguro de Retiro Privados",
  DONACIONES: "Donaciones",
  INTERESES_HIPOTECARIOS: "Intereses préstamo hipotecario",
  GASTOS_SEPELIO: "Gastos de sepelio",
  GASTOS_MEDICOS: "Gastos médicos y paramédicos",
  GASTOS_INDUMENTARIA_TRABAJO: "Gastos de Adquisición de Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
  ALQUILER_VIVIENDA: "Alquiler de inmuebles destinados a casa habitación",
  SERVICIO_DOMESTICO: "Deducción del personal doméstico",
  APORTE_SGR: "Aporte a sociedades de garantía recíproca",
  VEHICULOS_CORREDORES: "Vehículos de corredores y viajantes de comercio",
  INTERESES_CORREDORES: "Intereses de corredores y viajantes de comercio",
  GASTOS_EDUCATIVOS: "Gastos de Educación",
  OTRAS_DEDUCCIONES: "Otras deducciones",
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
    case "CUOTAS_MEDICO_ASISTENCIALES": {
      const netCap = netIncome.mul(limits.cuotasMedicoAsistenciales.netIncomeCapRate);
      cap = netCap;
      deductible = Decimal.min(annualAmount, netCap);
      notes = `100% deducible, tope 5% de ganancia neta ($${netCap.toFixed(0)})`;
      break;
    }
    case "PRIMAS_SEGURO_MUERTE": {
      const l = limits.primasSeguroMuerte;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "PRIMAS_AHORRO_SEGUROS_MIXTOS": {
      const l = limits.primasAhorroSegurosMixtos;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "APORTES_RETIRO_PRIVADO": {
      const l = limits.aportesRetiroPrivado;
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
    case "INTERESES_HIPOTECARIOS": {
      const l = limits.interesesHipotecarios;
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
    case "GASTOS_INDUMENTARIA_TRABAJO": {
      deductible = annualAmount;
      notes = "100% deducible";
      break;
    }
    case "ALQUILER_VIVIENDA": {
      const l = limits.alquilerVivienda;
      rate = l.rate;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount.mul(l.rate), l.annualMax);
      notes = `40% del monto, tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "SERVICIO_DOMESTICO": {
      const l = limits.servicioDomestico;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "APORTE_SGR": {
      deductible = annualAmount;
      notes = "100% deducible";
      break;
    }
    case "VEHICULOS_CORREDORES": {
      deductible = annualAmount;
      notes = "100% deducible";
      break;
    }
    case "INTERESES_CORREDORES": {
      deductible = annualAmount;
      notes = "100% deducible";
      break;
    }
    case "GASTOS_EDUCATIVOS": {
      const l = limits.gastosEducativos;
      cap = l.annualMax;
      deductible = Decimal.min(annualAmount, l.annualMax);
      notes = `Tope anual $${l.annualMax.toFixed(0)}`;
      break;
    }
    case "OTRAS_DEDUCCIONES": {
      deductible = annualAmount;
      notes = "100% deducible";
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
