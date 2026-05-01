import { Sparkles, BarChart3, CreditCard, type LucideIcon } from "lucide-react";

export type SectionLink = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const sectionLinks: readonly SectionLink[] = [
  { label: "Cómo funciona", href: "/#desgrava", icon: Sparkles },
  { label: "Simulador", href: "/#simulador", icon: BarChart3 },
  { label: "Planes", href: "/#planes", icon: CreditCard },
] as const;
