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
