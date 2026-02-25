"use client";

import {
  CheckCircle,
  KeyRound,
  FileText,
  Bot,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StepState = "completed" | "active" | "pending";

const STEPS = [
  {
    title: "Credenciales ARCA",
    description: "Configura tu CUIT y clave fiscal para automatizar",
    completedDescription: "Tus credenciales estan configuradas",
    icon: KeyRound,
    href: "/credenciales",
    activeLabel: "Comenzar",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    activeBorder: "border-amber-300",
    activeShadow: "shadow-amber-100",
    activeBadgeBg: "bg-amber-100",
    activeBadgeText: "text-amber-700",
    activeCtaColor: "text-amber-600",
    step: 1,
  },
  {
    title: "Cargar factura",
    description: "Agrega facturas manualmente o subi un PDF",
    completedDescription: "Ya tenes facturas cargadas",
    icon: FileText,
    href: "/facturas/nueva",
    activeLabel: "Cargar",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    activeBorder: "border-blue-300",
    activeShadow: "shadow-blue-100",
    activeBadgeBg: "bg-blue-100",
    activeBadgeText: "text-blue-700",
    activeCtaColor: "text-blue-600",
    step: 2,
  },
  {
    title: "Automatizar carga",
    description: "Envia tus facturas a SiRADIG automaticamente",
    completedDescription: "Tus facturas fueron enviadas a SiRADIG",
    icon: Bot,
    href: "/automatizacion",
    activeLabel: "Automatizar",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    activeBorder: "border-green-300",
    activeShadow: "shadow-green-100",
    activeBadgeBg: "bg-green-100",
    activeBadgeText: "text-green-700",
    activeCtaColor: "text-green-600",
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
    <div className="space-y-6">
      <div
        className="animate-in fade-in duration-300"
        style={{ animationFillMode: "backwards" }}
      >
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {firstName}
        </h1>
        <p className="text-base text-gray-500 mt-1">
          {allDone
            ? "Gestiona tus deducciones y automatiza la carga en SiRADIG"
            : "Completa estos pasos para empezar a automatizar tus deducciones"}
        </p>
      </div>

      {allDone ? (
        <CelebrationBanner firstName={firstName} />
      ) : (
        <ProgressSection
          completedCount={completedCount}
          progressPercent={progressPercent}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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

function CelebrationBanner({ firstName }: { firstName: string }) {
  return (
    <div
      className="relative overflow-hidden bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl border border-green-200 p-6 animate-in fade-in zoom-in-95 duration-700"
      style={{ animationFillMode: "backwards" }}
    >
      <div className="absolute inset-0 ai-shimmer-border opacity-[0.07] pointer-events-none" />

      <div className="relative flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 animate-in zoom-in-0 duration-500"
          style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
        >
          <PartyPopper className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-green-900">
            Felicitaciones, {firstName}!
          </h2>
          <p className="text-sm text-green-700 mt-1">
            Completaste toda la configuracion. Tus deducciones se estan
            cargando automaticamente en SiRADIG.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressSection({
  completedCount,
  progressPercent,
}: {
  completedCount: number;
  progressPercent: number;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Tu progreso</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {completedCount} de 3 pasos completados
          </p>
        </div>
        <Badge variant="secondary">
          {progressPercent}%
        </Badge>
      </div>
      <Progress value={progressPercent} />
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

  const baseDelay = 200 + index * 150;

  return (
    <Link href={step.href} className="h-full">
      <div
        className={cn(
          "relative bg-white rounded-xl shadow-sm p-6 h-full min-h-[180px] flex flex-col transition-all duration-200 cursor-pointer",
          "animate-in fade-in slide-in-from-bottom-4 duration-500",
          isCompleted &&
            "border border-green-200 hover:shadow-md hover:border-green-300 hover:-translate-y-0.5",
          isActive &&
            cn(
              "border-2 shadow-md hover:shadow-lg hover:-translate-y-1",
              step.activeBorder,
              step.activeShadow
            ),
          isPending &&
            "border border-gray-200 opacity-60 hover:opacity-80"
        )}
        style={{
          animationDelay: `${baseDelay}ms`,
          animationFillMode: "backwards",
        }}
      >
        {isActive && (
          <div className="absolute -inset-px rounded-xl active-step-pulse ai-shimmer-border z-0 pointer-events-none opacity-40" />
        )}

        {isCompleted ? (
          <CheckCircle className="absolute top-4 right-4 h-5 w-5 text-green-500" />
        ) : (
          <span
            className={cn(
              "absolute top-4 right-4 w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center",
              isActive
                ? cn("animate-pulse", step.activeBadgeBg, step.activeBadgeText)
                : "bg-gray-100 text-gray-400"
            )}
          >
            {step.step}
          </span>
        )}

        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center mb-4 relative z-10",
            isCompleted ? "bg-green-50" : step.iconBg
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              isCompleted ? "text-green-600" : step.iconColor
            )}
          />
        </div>

        <h3 className="text-base font-semibold text-gray-900 mb-2 relative z-10">
          {step.title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed relative z-10">
          {isCompleted ? step.completedDescription : step.description}
        </p>

        {isCompleted && (
          <div className="mt-auto pt-3 relative z-10">
            <Badge
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-200"
            >
              Completado
            </Badge>
          </div>
        )}

        {isActive && (
          <div
            className={cn(
              "mt-auto pt-3 flex items-center text-sm font-medium relative z-10",
              step.activeCtaColor
            )}
          >
            {step.activeLabel}{" "}
            <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        )}
      </div>
    </Link>
  );
}
