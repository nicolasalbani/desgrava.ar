"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, FileText, Bot, Shield, ScanText, Download, SendIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BentoCard {
  icon: LucideIcon;
  title: string;
  description: string;
  span: "single" | "wide";
  accent: string;
  accentGlow: string;
}

const cards: BentoCard[] = [
  {
    icon: Calculator,
    title: "Simulador",
    description: "Calcula cuanto podes recuperar de ganancias antes de cargar nada. Sin registro.",
    span: "wide",
    accent: "group-hover:text-violet-500 dark:group-hover:text-violet-400",
    accentGlow: "bg-violet-500/10 dark:bg-violet-400/10",
  },
  {
    icon: Bot,
    title: "Inteligencia artificial",
    description:
      "La inteligencia artificial detecta la categoria de deduccion de cada factura por vos.",
    span: "single",
    accent: "group-hover:text-sky-500 dark:group-hover:text-sky-400",
    accentGlow: "bg-sky-500/10 dark:bg-sky-400/10",
  },
  {
    icon: Download,
    title: "Importá tus comprobantes",
    description: "Carga tu clave fiscal y traemos todos tus comprobantes en segundos.",
    span: "single",
    accent: "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
    accentGlow: "bg-emerald-500/10 dark:bg-emerald-400/10",
  },
  {
    icon: SendIcon,
    title: "Envío automático",
    description: "Con un click cargas todas tus deducciones sin entrar a ARCA.",
    span: "wide",
    accent: "group-hover:text-amber-500 dark:group-hover:text-amber-400",
    accentGlow: "bg-amber-500/10 dark:bg-amber-400/10",
  },
  {
    icon: Shield,
    title: "Seguridad bancaria",
    description: "Tu clave fiscal protegida con nivel de seguridad bancaria.",
    span: "single",
    accent: "group-hover:text-teal-500 dark:group-hover:text-teal-400",
    accentGlow: "bg-teal-500/10 dark:bg-teal-400/10",
  },
];

const spanClasses = {
  single: "col-span-1",
  wide: "col-span-1 md:col-span-2",
};

function BentoCardItem({ card, index }: { card: BentoCard; index: number }) {
  const Icon = card.icon;
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group border-border bg-card relative overflow-hidden rounded-2xl border p-6 transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 ${spanClasses[card.span]}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* Spotlight gradient that follows mouse */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, var(--color-primary) 0%, transparent 70%)`
            : "none",
          opacity: isHovered ? 0.06 : 0,
        }}
      />

      {/* Accent glow blob */}
      <div
        className={`pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-700 ${card.accentGlow} opacity-0 group-hover:opacity-100`}
      />

      {/* Icon */}
      <div className="bg-muted group-hover:bg-muted/80 relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110">
        <Icon
          className={`text-muted-foreground h-5 w-5 transition-all duration-300 group-hover:scale-110 ${card.accent}`}
        />
      </div>

      {/* Content */}
      <h3 className="text-foreground relative mb-2 font-semibold tracking-tight">{card.title}</h3>
      <p className="text-muted-foreground relative text-sm leading-relaxed">{card.description}</p>

      {/* Bottom border accent on hover */}
      <div className="via-primary absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent to-transparent transition-all duration-500 group-hover:w-2/3" />
    </div>
  );
}

export function FeaturesBento() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card, i) => (
        <BentoCardItem key={card.title} card={card} index={i} />
      ))}
    </div>
  );
}
