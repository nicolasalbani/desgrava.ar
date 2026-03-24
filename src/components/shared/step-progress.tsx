"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import type { StepDefinition } from "@/lib/automation/job-steps";

interface StepProgressProps {
  steps: StepDefinition[];
  currentStep: string | null;
  status: string;
  errorMessage?: string | null;
}

export function StepProgress({ steps, currentStep, status, errorMessage }: StepProgressProps) {
  if (steps.length === 0) return null;

  const currentIndex = currentStep ? steps.findIndex((s) => s.key === currentStep) : -1;

  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const state = getStepState(i, currentIndex, status);

        return (
          <div key={step.key}>
            <div className="flex items-center gap-2.5">
              <StepIcon state={state} />
              <span
                className={
                  state === "active"
                    ? "text-foreground text-sm font-medium"
                    : state === "completed"
                      ? "text-foreground text-sm"
                      : state === "failed"
                        ? "text-sm font-medium text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground/50 text-sm"
                }
              >
                {step.label}
              </span>
            </div>
            {state === "failed" && errorMessage && (
              <p className="mt-1 ml-[26px] text-xs text-rose-600 dark:text-rose-400">
                {errorMessage}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

type StepState = "completed" | "active" | "pending" | "failed";

function getStepState(index: number, currentIndex: number, jobStatus: string): StepState {
  if (jobStatus === "COMPLETED") return "completed";

  if (jobStatus === "FAILED") {
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "failed";
    return "pending";
  }

  // RUNNING or PENDING
  if (currentIndex < 0) return "pending";
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "active";
  return "pending";
}

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "completed":
      return <Check className="h-4 w-4 shrink-0 text-emerald-500" />;
    case "active":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />;
    case "failed":
      return <X className="h-4 w-4 shrink-0 text-rose-500" />;
    case "pending":
      return <Circle className="text-muted-foreground/30 h-4 w-4 shrink-0" />;
  }
}
