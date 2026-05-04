import type { SimuladorCategory } from "./deduction-rules";

export type SimuladorCategoryKey =
  | "alquiler"
  | "prepaga"
  | "salud"
  | "educacion"
  | "hipotecario"
  | "domestico";

export type SimuladorCategoryHue = "purple" | "rose" | "sky" | "amber" | "emerald" | "indigo";

export interface SimuladorCategoryConfig {
  key: SimuladorCategoryKey;
  category: SimuladorCategory;
  label: string;
  hint: string;
  hue: SimuladorCategoryHue;
}

export const SIMULADOR_CATEGORIES: SimuladorCategoryConfig[] = [
  {
    key: "alquiler",
    category: "ALQUILER_VIVIENDA",
    label: "Alquiler",
    hint: "40% deducible",
    hue: "purple",
  },
  {
    key: "prepaga",
    category: "CUOTAS_MEDICO_ASISTENCIALES",
    label: "Prepaga",
    hint: "100% deducible",
    hue: "rose",
  },
  {
    key: "salud",
    category: "GASTOS_MEDICOS",
    label: "Salud",
    hint: "40% deducible",
    hue: "sky",
  },
  {
    key: "educacion",
    category: "GASTOS_EDUCATIVOS",
    label: "Educación",
    hint: "100% deducible",
    hue: "amber",
  },
  {
    key: "hipotecario",
    category: "INTERESES_HIPOTECARIOS",
    label: "Intereses hipot.",
    hint: "100% deducible",
    hue: "emerald",
  },
  {
    key: "domestico",
    category: "SERVICIO_DOMESTICO",
    label: "Personal doméstico",
    hint: "100% deducible",
    hue: "indigo",
  },
];

export const SLIDER_MAX_MONTHLY = 10_000_000;
export const SLIDER_STEP = 1_000;

export function findConfigByCategory(category: string): SimuladorCategoryConfig | undefined {
  return SIMULADOR_CATEGORIES.find((c) => c.category === category);
}

export const HUE_CLASSES: Record<
  SimuladorCategoryHue,
  {
    iconBg: string;
    iconText: string;
    sliderRange: string;
    sliderThumb: string;
  }
> = {
  purple: {
    iconBg: "bg-purple-100 dark:bg-purple-950/40",
    iconText: "text-purple-600 dark:text-purple-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-purple-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-purple-500",
  },
  rose: {
    iconBg: "bg-rose-100 dark:bg-rose-950/40",
    iconText: "text-rose-600 dark:text-rose-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-rose-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-rose-500",
  },
  sky: {
    iconBg: "bg-sky-100 dark:bg-sky-950/40",
    iconText: "text-sky-600 dark:text-sky-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-sky-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-sky-500",
  },
  amber: {
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconText: "text-amber-600 dark:text-amber-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-amber-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-amber-500",
  },
  emerald: {
    iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
    iconText: "text-emerald-600 dark:text-emerald-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-emerald-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-emerald-500",
  },
  indigo: {
    iconBg: "bg-indigo-100 dark:bg-indigo-950/40",
    iconText: "text-indigo-600 dark:text-indigo-400",
    sliderRange: "[&_[data-slot=slider-range]]:bg-indigo-500",
    sliderThumb: "[&_[data-slot=slider-thumb]]:border-indigo-500",
  },
};
