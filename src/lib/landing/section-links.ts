import { Sparkles, BarChart3, CreditCard, type LucideIcon } from "lucide-react";

export type SectionLink = {
  label: string;
  /** In-page hash anchor used when the navbar is rendered on the home page (`/`). */
  anchorHref: string;
  /** Dedicated page route used when the navbar is rendered anywhere else. */
  pageHref: string;
  icon: LucideIcon;
};

export const sectionLinks: readonly SectionLink[] = [
  { label: "Cómo funciona", anchorHref: "/#desgrava", pageHref: "/como-funciona", icon: Sparkles },
  { label: "Simulador", anchorHref: "/#simulador", pageHref: "/simulador", icon: BarChart3 },
  { label: "Planes", anchorHref: "/#planes", pageHref: "/planes", icon: CreditCard },
] as const;
