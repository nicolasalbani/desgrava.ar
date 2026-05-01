export interface StepDefinition {
  key: string;
  label: string;
}

export const JOB_TYPE_STEPS: Record<string, StepDefinition[]> = {
  VALIDATE_CREDENTIALS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "verify", label: "Verificando credenciales" },
    { key: "done", label: "Listo" },
  ],
  PULL_COMPROBANTES: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "siradig_extract", label: "Extrayendo comprobantes deducidos" },
    { key: "navigate_comprobantes", label: "Buscando comprobantes deducibles" },
    { key: "download", label: "Extrayendo comprobantes deducibles" },
    { key: "classify", label: "Clasificando proveedores" },
  ],
  PULL_FAMILY_DEPENDENTS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "extract", label: "Extrayendo cargas de familia" },
    { key: "done", label: "Listo" },
  ],
  PUSH_FAMILY_DEPENDENTS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "upload", label: "Cargando familiares" },
    { key: "done", label: "Listo" },
  ],
  SUBMIT_INVOICE: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "fill", label: "Cargando deducción" },
    { key: "done", label: "Listo" },
  ],
  BULK_SUBMIT: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "fill", label: "Cargando deducciones" },
    { key: "done", label: "Listo" },
  ],
  // Note: BULK_SUBMIT is defined for DB enum compatibility but not actively used.
  // Multiple invoices are submitted as individual SUBMIT_INVOICE jobs.
  PULL_DOMESTIC_WORKERS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "download", label: "Descargando personal doméstico" },
    { key: "save", label: "Guardando datos" },
    { key: "done", label: "Listo" },
  ],
  PULL_DOMESTIC_RECEIPTS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "siradig_extract", label: "Leyendo deducciones" },
    { key: "download", label: "Descargando recibos" },
    { key: "save", label: "Guardando recibos" },
    { key: "done", label: "Listo" },
  ],
  SUBMIT_DOMESTIC_DEDUCTION: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "fill", label: "Cargando deducción" },
    { key: "done", label: "Listo" },
  ],
  PULL_PRESENTACIONES: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "download", label: "Descargando presentaciones" },
    { key: "done", label: "Listo" },
  ],
  SUBMIT_PRESENTACION: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "submit", label: "Enviando presentación" },
    { key: "done", label: "Listo" },
  ],
  PULL_EMPLOYERS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "extract", label: "Extrayendo empleadores" },
    { key: "done", label: "Listo" },
  ],
  PUSH_EMPLOYERS: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "upload", label: "Cargando empleador" },
    { key: "done", label: "Listo" },
  ],
  PULL_PERSONAL_DATA: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "extract", label: "Extrayendo datos personales" },
    { key: "done", label: "Listo" },
  ],
  PULL_PROFILE: [
    { key: "login", label: "Iniciando sesión en ARCA" },
    { key: "siradig", label: "Abriendo SiRADIG" },
    { key: "datos_personales", label: "Extrayendo datos personales" },
    { key: "empleadores", label: "Extrayendo empleadores" },
    { key: "cargas_familia", label: "Extrayendo cargas de familia" },
    { key: "casas_particulares", label: "Importando trabajadores domésticos" },
    { key: "done", label: "Listo" },
  ],
};

export function getStepsForJobType(jobType: string): StepDefinition[] {
  return JOB_TYPE_STEPS[jobType] ?? [];
}

/**
 * Per-step expected duration (seconds) for the four ARCA imports tracked by the
 * progress strip. Used by `computeProgressSnapshot` to weight progress so the
 * percent reflects real wall-clock time rather than step-index.
 *
 * TODO: replace with empirical p50/p75 durations once we have enough finished-job
 * telemetry. Today's numbers are conservative best-guesses.
 */
export const JOB_STEP_DURATIONS: Record<string, Record<string, number>> = {
  PULL_COMPROBANTES: {
    login: 5,
    siradig: 5,
    siradig_extract: 8,
    navigate_comprobantes: 5,
    download: 30,
    classify: 12,
  },
  PULL_DOMESTIC_RECEIPTS: {
    login: 5,
    siradig: 5,
    siradig_extract: 5,
    download: 25,
    save: 3,
    done: 1,
  },
  PULL_PRESENTACIONES: {
    login: 5,
    siradig: 5,
    download: 20,
    done: 1,
  },
  PULL_PROFILE: {
    login: 5,
    siradig: 5,
    datos_personales: 8,
    empleadores: 8,
    cargas_familia: 8,
    casas_particulares: 15,
    done: 1,
  },
};
