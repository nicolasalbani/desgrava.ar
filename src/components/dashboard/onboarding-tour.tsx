"use client";

import {
  Check,
  User,
  KeyRound,
  FileText,
  Send,
  ArrowRight,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/fiscal-year";

type StepState = "completed" | "active" | "pending";

const CURRENT_YEAR = new Date().getFullYear();

interface StepDef {
  id: string;
  title: string;
  description: string;
  completedDescription: string;
  icon: React.ElementType;
  href: string | null;
  activeLabel: string | null;
}

function getSteps(fiscalYear: number): StepDef[] {
  return [
    {
      id: "credentials",
      title: "Credenciales ARCA",
      description: "Configura tu CUIT y clave fiscal de ARCA",
      completedDescription: "Credenciales configuradas",
      icon: KeyRound,
      href: "/credenciales",
      activeLabel: "Configurar",
    },
    {
      id: "fiscal-year",
      title: "Año fiscal",
      description: "¿Para qué período fiscal cargás tus deducciones?",
      completedDescription: `Año ${fiscalYear} seleccionado`,
      icon: CalendarDays,
      href: null,
      activeLabel: "Seleccionar",
    },
    {
      id: "perfil",
      title: "Perfil impositivo",
      description: "Declara tus cargas de familia y preferencias",
      completedDescription: "Perfil impositivo configurado",
      icon: User,
      href: "/perfil",
      activeLabel: "Completar",
    },
    {
      id: "invoices",
      title: "Cargar facturas",
      description: "Subi un PDF, envia por email o carga manualmente",
      completedDescription: "Facturas cargadas",
      icon: FileText,
      href: "/facturas?intro=1",
      activeLabel: "Cargar",
    },
    {
      id: "automation",
      title: "Enviar a SiRADIG",
      description: "Envia tus deducciones a SiRADIG",
      completedDescription: "Envios activos",
      icon: Send,
      href: "/automatizacion",
      activeLabel: "Enviar",
    },
  ];
}

function getStepState(index: number, completedSteps: boolean[]): StepState {
  if (completedSteps[index]) return "completed";
  const firstUncompleted = completedSteps.findIndex((done) => !done);
  return firstUncompleted === index ? "active" : "pending";
}

interface OnboardingTourProps {
  completedSteps: [boolean, boolean, boolean, boolean, boolean];
  firstName: string;
}

export function OnboardingTour({ completedSteps, firstName }: OnboardingTourProps) {
  const { fiscalYear } = useFiscalYear();
  const steps = getSteps(fiscalYear ?? CURRENT_YEAR);
  const completedCount = completedSteps.filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 5) * 100);
  const allDone = completedCount === 5;

  function openFiscalYearSelector() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("open-fiscal-year-selector"));
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-in fade-in duration-500" style={{ animationFillMode: "backwards" }}>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {firstName}</h1>
        <p className="text-muted-foreground mt-1">
          {allDone
            ? "Todo listo. Tu cuenta esta completamente configurada."
            : "Configura tu cuenta en cuatro simples pasos."}
        </p>
      </div>

      {/* Progress — only while incomplete */}
      {!allDone && (
        <div
          className="animate-in fade-in slide-in-from-bottom-1 duration-400"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Progreso
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">{completedCount}/5</p>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Celebration — only when all done */}
      {allDone && <CelebrationBanner />}

      {/* Step cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            state={getStepState(index, completedSteps)}
            index={index}
            onClick={step.id === "fiscal-year" ? openFiscalYearSelector : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function CelebrationBanner() {
  return (
    <div
      className="animate-in fade-in flex items-center gap-3 duration-700"
      style={{ animationFillMode: "backwards" }}
    >
      <div
        className="bg-primary/10 animate-in zoom-in-50 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full duration-500"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      >
        <Sparkles className="text-primary h-4 w-4" />
      </div>
      <p className="text-muted-foreground text-sm">
        Completaste la configuracion. Tus deducciones se cargan automaticamente en SiRADIG.
      </p>
    </div>
  );
}

function StepCard({
  step,
  state,
  index,
  onClick,
}: {
  step: StepDef;
  state: StepState;
  index: number;
  onClick?: () => void;
}) {
  const Icon = step.icon;
  const isCompleted = state === "completed";
  const isActive = state === "active";
  const isPending = state === "pending";

  const baseDelay = 150 + index * 100;

  const inner = (
    <div
      className={cn(
        "group relative flex h-full min-h-[164px] flex-col rounded-2xl p-5",
        "transition-all duration-300 ease-out",
        "animate-in fade-in slide-in-from-bottom-3 duration-500",
        isCompleted && [
          "bg-primary/[0.03] border-primary/10 border",
          "hover:bg-primary/[0.05] hover:border-primary/15",
          "hover:shadow-sm",
        ],
        isActive && [
          "dark:bg-card border-border border bg-white shadow-md",
          "hover:-translate-y-0.5 hover:shadow-lg",
        ],
        isPending && ["border border-transparent bg-transparent", "opacity-40 hover:opacity-55"],
      )}
      style={{ animationDelay: `${baseDelay}ms`, animationFillMode: "backwards" }}
    >
      {/* Step indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300",
            isCompleted && "bg-primary/10",
            isActive && "bg-primary/8",
            isPending && "bg-muted",
          )}
        >
          <Icon
            className={cn(
              "h-[18px] w-[18px] transition-colors duration-300",
              isCompleted && "text-primary",
              isActive && "text-primary",
              isPending && "text-muted-foreground/70",
            )}
          />
        </div>

        {isCompleted && (
          <div className="bg-primary animate-in zoom-in-0 flex h-6 w-6 items-center justify-center rounded-full duration-300">
            <Check className="text-primary-foreground h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
        )}

        {isActive && (
          <span className="text-primary/70 text-[11px] font-medium tracking-wide uppercase">
            Siguiente
          </span>
        )}
      </div>

      {/* Content */}
      <h3
        className={cn(
          "mb-1 text-sm font-semibold transition-colors duration-300",
          isCompleted && "text-primary",
          isActive && "text-foreground",
          isPending && "text-muted-foreground",
        )}
      >
        {step.title}
      </h3>
      <p
        className={cn(
          "text-xs leading-relaxed transition-colors duration-300",
          isCompleted && "text-primary/50",
          isActive && "text-muted-foreground",
          isPending && "text-muted-foreground/60",
        )}
      >
        {isCompleted ? step.completedDescription : step.description}
      </p>

      {/* Navigation CTA (active) */}
      {isActive && step.activeLabel && (
        <div className="text-primary mt-auto flex items-center gap-1 pt-3 text-xs font-medium transition-all duration-300 group-hover:gap-1.5">
          {step.activeLabel}
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  if (step.href) {
    return (
      <Link href={step.href} className="h-full">
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button className="h-full text-left" onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className="h-full">{inner}</div>;
}
