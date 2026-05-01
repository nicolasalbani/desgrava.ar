"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshArcaProgress, useArcaImportProgress } from "@/hooks/use-arca-import-progress";
import type { TrackedJobType } from "@/lib/onboarding/progress-stages";

type ImportableJobType = Extract<
  TrackedJobType,
  "PULL_COMPROBANTES" | "PULL_DOMESTIC_RECEIPTS" | "PULL_PRESENTACIONES" | "PULL_PROFILE"
>;

interface BaseProps {
  jobType: ImportableJobType;
  /** When `null` the button is force-disabled until the fiscal year context loads. */
  fiscalYear: number | null;
  label?: string;
  /** Hides the running fill animation; useful when the consumer renders its
   *  own progress UI nearby. Defaults to `false`. */
  disableFill?: boolean;
  /** Extra disabled constraint (e.g., readOnly fiscal year). */
  disabled?: boolean;
}

interface CardProps extends BaseProps {
  mode: "card";
  variant?: "primary" | "secondary";
}

interface ToolbarProps extends BaseProps {
  mode: "toolbar";
  icon: ComponentType<{ className?: string }>;
}

type Props = CardProps | ToolbarProps;

const DEFAULT_LABEL = "Importar desde ARCA";

export function ArcaImportButton(props: Props) {
  const { jobType, fiscalYear, label = DEFAULT_LABEL, disabled = false } = props;
  const router = useRouter();
  const { snapshot } = useArcaImportProgress();
  const [enqueueing, setEnqueueing] = useState(false);

  const isRunning = snapshot.runningTypes.includes(jobType);
  const percent = isRunning ? (snapshot.percentByType[jobType] ?? 0) : 0;
  const showFill = isRunning && !props.disableFill;
  const runningLabel = "Descargando…";

  async function handleClick() {
    if (isRunning || enqueueing || fiscalYear == null) return;
    setEnqueueing(true);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType, fiscalYear }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        // 409 / dedup is fine — strip already shows the running job.
        if (res.status === 409) {
          refreshArcaProgress();
          router.refresh();
          return;
        }
        throw new Error(data.error ?? "No se pudo iniciar la importación");
      }
      toast.success("Importación iniciada");
      // Wake every mounted progress hook so the strip and this button switch
      // into running state without waiting for the next 4s poll.
      refreshArcaProgress();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setEnqueueing(false);
    }
  }

  const isDisabled = disabled || isRunning || enqueueing || fiscalYear == null;
  const ariaLabel = isRunning ? `${label} en progreso, ${percent}%` : label;

  if (props.mode === "card") {
    const variantClasses =
      (props.variant ?? "primary") === "primary"
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-card border border-border text-foreground hover:bg-muted";

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-label={ariaLabel}
        className={cn(
          "relative flex h-11 min-h-[44px] flex-1 items-center justify-center overflow-hidden rounded-md px-4 text-sm font-medium transition-colors",
          variantClasses,
          isDisabled && "cursor-not-allowed opacity-70",
        )}
      >
        {showFill && (
          <span
            className="bg-foreground/15 absolute inset-y-0 left-0 transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
        )}
        <span className="relative flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 shrink-0" />
          )}
          {isRunning ? runningLabel : label}
        </span>
      </button>
    );
  }

  // toolbar mode: icon-only at rest, expands on hover, and stays expanded
  // with progress fill while running. Mirrors the existing ExpandingButton
  // shape so it sits next to the other toolbar buttons.
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={ariaLabel}
      className={cn(
        "group bg-card border-border text-foreground hover:bg-muted relative inline-flex h-9 items-center overflow-hidden rounded-md border px-3 text-sm font-medium transition-colors",
        isDisabled && "cursor-not-allowed opacity-70",
        isRunning && "ring-primary/20 ring-2 ring-offset-0",
      )}
    >
      {showFill && (
        <span
          className="bg-primary/15 absolute inset-y-0 left-0 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      )}
      <span className="relative flex items-center">
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out",
            isRunning
              ? "ml-2 max-w-[200px] opacity-100"
              : "group-hover:ml-2 group-hover:max-w-[200px] group-hover:opacity-100",
          )}
        >
          {isRunning ? runningLabel : label}
        </span>
      </span>
    </button>
  );
}
