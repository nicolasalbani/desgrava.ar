"use client";

import {
  Check,
  KeyRound,
  FileText,
  Bot,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StepState = "completed" | "active" | "pending";

const STEPS = [
  {
    title: "Credenciales ARCA",
    description: "Configura tu CUIT y clave fiscal",
    completedDescription: "Credenciales configuradas",
    icon: KeyRound,
    href: "/credenciales",
    activeLabel: "Configurar",
    step: 1,
  },
  {
    title: "Cargar facturas",
    description: "Subi un PDF o carga manualmente",
    completedDescription: "Facturas cargadas",
    icon: FileText,
    href: "/facturas",
    activeLabel: "Cargar",
    step: 2,
  },
  {
    title: "Automatizar",
    description: "Envia tus deducciones a SiRADIG",
    completedDescription: "Automatizacion activa",
    icon: Bot,
    href: "/automatizacion",
    activeLabel: "Automatizar",
    step: 3,
  },
];

function getStepState(
  index: number,
  completedSteps: boolean[]
): StepState {
  if (completedSteps[index]) return "completed";
  const firstUncompleted = completedSteps.findIndex((done) => !done);
  return firstUncompleted === index ? "active" : "pending";
}

interface OnboardingTourProps {
  completedSteps: [boolean, boolean, boolean];
  firstName: string;
}

export function OnboardingTour({
  completedSteps,
  firstName,
}: OnboardingTourProps) {
  const completedCount = completedSteps.filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 3) * 100);
  const allDone = completedCount === 3;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="animate-in fade-in duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {allDone
            ? "Todo listo. Tu cuenta esta completamente configurada."
            : "Configura tu cuenta en tres simples pasos."}
        </p>
      </div>

      {/* Progress — only while incomplete */}
      {!allDone && (
        <div
          className="animate-in fade-in slide-in-from-bottom-1 duration-400"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Progreso
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {completedCount}/3
            </p>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Celebration — only when all done */}
      {allDone && <CelebrationBanner />}

      {/* Step cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS.map((step, index) => (
          <StepCard
            key={step.href}
            step={step}
            state={getStepState(index, completedSteps)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function CelebrationBanner() {
  return (
    <div
      className="flex items-center gap-3 animate-in fade-in duration-700"
      style={{ animationFillMode: "backwards" }}
    >
      <div
        className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 animate-in zoom-in-50 duration-500"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      >
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">
        Completaste la configuracion. Tus deducciones se cargan automaticamente en SiRADIG.
      </p>
    </div>
  );
}

function StepCard({
  step,
  state,
  index,
}: {
  step: (typeof STEPS)[number];
  state: StepState;
  index: number;
}) {
  const Icon = step.icon;
  const isCompleted = state === "completed";
  const isActive = state === "active";
  const isPending = state === "pending";

  const baseDelay = 150 + index * 100;

  return (
    <Link href={step.href} className="h-full">
      <div
        className={cn(
          "group relative rounded-2xl p-5 h-full min-h-[164px] flex flex-col",
          "transition-all duration-300 ease-out",
          "animate-in fade-in slide-in-from-bottom-3 duration-500",
          isCompleted && [
            "bg-primary/[0.03] border border-primary/10",
            "hover:bg-primary/[0.05] hover:border-primary/15",
            "hover:shadow-sm",
          ],
          isActive && [
            "bg-white border border-border shadow-md",
            "hover:shadow-lg hover:-translate-y-0.5",
          ],
          isPending && [
            "bg-transparent border border-transparent",
            "opacity-40 hover:opacity-55",
          ]
        )}
        style={{
          animationDelay: `${baseDelay}ms`,
          animationFillMode: "backwards",
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
              isCompleted && "bg-primary/10",
              isActive && "bg-primary/8",
              isPending && "bg-muted"
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] transition-colors duration-300",
                isCompleted && "text-primary",
                isActive && "text-primary",
                isPending && "text-muted-foreground/70"
              )}
            />
          </div>

          {isCompleted && (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-0 duration-300">
              <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
          )}

          {isActive && (
            <span className="text-[11px] font-medium text-primary/70 tracking-wide uppercase">
              Siguiente
            </span>
          )}
        </div>

        {/* Content */}
        <h3
          className={cn(
            "text-sm font-semibold mb-1 transition-colors duration-300",
            isCompleted && "text-primary",
            isActive && "text-foreground",
            isPending && "text-muted-foreground"
          )}
        >
          {step.title}
        </h3>
        <p
          className={cn(
            "text-xs leading-relaxed transition-colors duration-300",
            isCompleted && "text-primary/50",
            isActive && "text-muted-foreground",
            isPending && "text-muted-foreground/60"
          )}
        >
          {isCompleted ? step.completedDescription : step.description}
        </p>

        {/* Active CTA */}
        {isActive && (
          <div className="mt-auto pt-3 flex items-center text-xs font-medium text-primary group-hover:gap-1.5 gap-1 transition-all duration-300">
            {step.activeLabel}
            <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </div>
    </Link>
  );
}
