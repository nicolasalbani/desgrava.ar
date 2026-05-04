import type { SimuladorCategoryKey } from "./category-config";

export type PersonaPresetId =
  | "soltero-inquilino"
  | "familia-tipo"
  | "familia-casa-propia"
  | "profesional-hijos-colegio"
  | "personalizado";

export interface PersonaPreset {
  id: PersonaPresetId;
  label: string;
  tieneHijos: number;
  tieneConyuge: boolean;
  /** Monthly amounts in ARS, per category key. Missing keys default to 0. */
  montos: Partial<Record<SimuladorCategoryKey, number>>;
}

// Monthly amounts (ARS) calibrated to typical CABA middle-class costs in 2026.
// Sources researched May 2026: ZonaProp/Infobae for alquiler, OSDE/iProfesional
// for prepaga, UPACP scale for personal doméstico, Ámbito/Cronista for cuotas
// de colegio privado, Infobae for tasas UVA hipotecarias.
export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: "familia-tipo",
    label: "Familia tipo",
    tieneHijos: 1,
    tieneConyuge: true,
    montos: {
      alquiler: 900_000,
      prepaga: 600_000,
      salud: 40_000,
    },
  },
  {
    id: "soltero-inquilino",
    label: "Soltero inquilino",
    tieneHijos: 0,
    tieneConyuge: false,
    montos: {
      alquiler: 660_000,
      prepaga: 250_000,
      salud: 25_000,
    },
  },
  {
    id: "familia-casa-propia",
    label: "Familia con casa propia",
    tieneHijos: 2,
    tieneConyuge: true,
    montos: {
      hipotecario: 400_000,
      prepaga: 900_000,
      domestico: 600_000,
    },
  },
  {
    id: "profesional-hijos-colegio",
    label: "Profesional con hijos en colegio privado",
    tieneHijos: 2,
    tieneConyuge: true,
    montos: {
      prepaga: 900_000,
      educacion: 700_000,
    },
  },
  {
    id: "personalizado",
    label: "Personalizado",
    tieneHijos: 0,
    tieneConyuge: false,
    montos: {},
  },
];

export const DEFAULT_PERSONA_ID: PersonaPresetId = "familia-tipo";

export function getPreset(id: PersonaPresetId): PersonaPreset {
  const found = PERSONA_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown persona preset: ${id}`);
  return found;
}
