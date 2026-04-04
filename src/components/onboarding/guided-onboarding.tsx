"use client";

import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { OnboardingStepCredentials } from "./onboarding-step-credentials";
import { OnboardingStepProfile } from "./onboarding-step-profile";
import { OnboardingStepInvoices } from "./onboarding-step-invoices";
import { OnboardingStepSubmit } from "./onboarding-step-submit";

interface OnboardingState {
  step: number;
  hasCredentials: boolean;
  credentialsValidated: boolean;
  activePullProfileJobId: string | null;
  activePullProfileStep: string | null;
  profilePullCompleted: boolean;
  activePullComprobantesJobId: string | null;
  activeSubmitInvoiceJobId: string | null;
  deducibleInvoiceCount: number;
  hasCompletedSubmission: boolean;
}

const STEP_LABELS = [
  "Credenciales ARCA",
  "Perfil impositivo",
  "Importar comprobantes",
  "Primera deducción",
];

export function GuidedOnboarding({ onComplete }: { onComplete: () => void }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [fading, setFading] = useState(false);

  // Pull profile job ID passed from step 1 → step 2
  const [pullProfileJobId, setPullProfileJobId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/state")
      .then((r) => r.json())
      .then((data: OnboardingState) => {
        setState(data);
        // Resume at correct step, capped at 4
        setCurrentStep(Math.min(data.step, 4));
        if (data.activePullProfileJobId) {
          setPullProfileJobId(data.activePullProfileJobId);
        }
      });
  }, []);

  const completeOnboarding = useCallback(async () => {
    setFading(true);
    await fetch("/api/onboarding/complete", { method: "POST" });
    // Wait for fade animation
    setTimeout(() => onComplete(), 700);
  }, [onComplete]);

  const advanceToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  if (!state) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background fixed inset-0 z-50 flex flex-col overflow-y-auto transition-opacity duration-700",
        fading && "pointer-events-none opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-center px-4 pt-6 pb-2 sm:pt-8">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Image src="/logo.png" alt="desgrava.ar" width={20} height={20} />
          desgrava.ar
        </div>
      </div>

      {/* Step indicator */}
      <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 px-4 py-6 sm:gap-3">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <div key={label} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && (
                <div
                  className={cn(
                    "h-px w-4 sm:w-8",
                    isCompleted || isActive ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "bg-primary text-primary-foreground ring-primary/20 ring-4",
                    !isCompleted && !isActive && "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={cn(
                    "hidden text-center text-[11px] sm:block",
                    isActive ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-start justify-center px-4 py-4 sm:items-center sm:py-0">
        <div className="w-full max-w-lg">
          {currentStep === 1 && (
            <OnboardingStepCredentials
              hasCredentials={state.hasCredentials}
              onComplete={(jobId) => {
                setPullProfileJobId(jobId);
                advanceToStep(2);
              }}
            />
          )}
          {currentStep === 2 && (
            <OnboardingStepProfile
              pullProfileJobId={pullProfileJobId}
              onComplete={() => advanceToStep(3)}
            />
          )}
          {currentStep === 3 && (
            <OnboardingStepInvoices
              activeJobId={state.activePullComprobantesJobId}
              onComplete={(hasDeducible) => {
                if (hasDeducible) {
                  advanceToStep(4);
                } else {
                  completeOnboarding();
                }
              }}
            />
          )}
          {currentStep === 4 && (
            <OnboardingStepSubmit
              activeJobId={state.activeSubmitInvoiceJobId}
              onComplete={completeOnboarding}
            />
          )}
        </div>
      </div>
    </div>
  );
}
