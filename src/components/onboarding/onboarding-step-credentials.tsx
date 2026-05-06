"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, KeyRound, Lock, Check } from "lucide-react";
import { formatCuit, validateCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";
import { useJobStatus } from "@/hooks/use-job-status";

const formSchema = z.object({
  cuit: z
    .string()
    .min(1, "El CUIT es requerido")
    .refine(
      (val) => {
        const cleaned = val.replace(/-/g, "");
        return /^\d{11}$/.test(cleaned);
      },
      { message: "El CUIT debe tener 11 digitos" },
    )
    .refine((val) => validateCuit(val.replace(/-/g, "")), {
      message: "El CUIT no es valido (digito verificador incorrecto)",
    }),
  clave: z.string().min(1, "La clave fiscal es requerida"),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  hasCredentials: boolean;
  onComplete: (pullProfileJobId: string | null) => void;
}

// Once any of these steps is reached, ARCA login + SiRADIG are done and we can
// advance to the next onboarding step in parallel with the rest of the import.
const PROFILE_READY_STEPS = new Set([
  "datos_personales",
  "empleadores",
  "cargas_familia",
  "casas_particulares",
  "done",
]);

export function OnboardingStepCredentials({ hasCredentials, onComplete }: Props) {
  const [saving, setSaving] = useState(false);
  const [showClave, setShowClave] = useState(false);
  // Post-validation: waiting for ARCA login + SiRADIG to connect
  const [connectingPhase, setConnectingPhase] = useState<"login" | "siradig" | "ready" | null>(
    null,
  );
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { cuit: "", clave: "" },
  });

  const { currentStep } = useJobStatus(pendingJobId, {
    onTerminal: () => {
      // Job finished before we observed datos_personales — advance anyway.
      if (pendingJobId && connectingPhase !== "ready") {
        setConnectingPhase("ready");
        onComplete(pendingJobId);
        setPendingJobId(null);
      }
    },
  });

  useEffect(() => {
    if (!pendingJobId || !currentStep || connectingPhase === "ready") return;
    if (currentStep === "siradig") {
      setConnectingPhase("siradig");
      return;
    }
    if (PROFILE_READY_STEPS.has(currentStep)) {
      setConnectingPhase("ready");
      onComplete(pendingJobId);
      setPendingJobId(null);
    }
  }, [currentStep, pendingJobId, connectingPhase, onComplete]);

  function waitForProfileReady(jobId: string) {
    setPendingJobId(jobId);
    setConnectingPhase("login");
  }

  // If user already has credentials, skip to validation
  if (hasCredentials) {
    return (
      <div className="animate-in fade-in space-y-6 text-center duration-500">
        <div className="bg-primary/10 mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <KeyRound className="text-primary h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Credenciales ARCA configuradas</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Ya tenés tus credenciales guardadas. Continuemos.
          </p>
        </div>
        <Button onClick={() => onComplete(null)}>Continuar</Button>
      </div>
    );
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      // Save credentials
      const saveRes = await fetch("/api/credenciales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuit: data.cuit.replace(/-/g, ""),
          clave: data.clave,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        toast.error(err.error || "Error al guardar credenciales");
        return;
      }

      // Validate — this also auto-triggers PULL_PROFILE
      const valRes = await fetch("/api/credenciales/validar", { method: "POST" });
      if (!valRes.ok) {
        toast.error("Error al validar credenciales");
        return;
      }

      const valData = await valRes.json();
      toast.success("Credenciales guardadas");

      const jobId = valData.pullProfileJobId;
      if (jobId) {
        // Wait for ARCA login + SiRADIG to finish before advancing to step 2
        waitForProfileReady(jobId);
      } else {
        onComplete(null);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  function handleCuitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCuit(e.target.value);
    form.setValue("cuit", formatted, { shouldValidate: true });
  }

  // Show connecting progress after credentials are saved
  if (connectingPhase) {
    const steps = [
      { key: "login", label: "Verificando credenciales" },
      { key: "siradig", label: "Abriendo ARCA" },
    ];
    const currentIndex = connectingPhase === "login" ? 0 : 1;

    return (
      <div className="animate-in fade-in space-y-6 duration-500">
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <KeyRound className="text-primary h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">Verificando credenciales</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Preparando todo para importar tu perfil impositivo...
          </p>
        </div>

        <div className="bg-muted/50 space-y-2.5 rounded-xl p-4">
          {steps.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isActive = i === currentIndex && connectingPhase !== "ready";

            return (
              <div key={step.key} className="flex items-center gap-2.5">
                {isCompleted ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                ) : (
                  <div className="text-muted-foreground/30 h-4 w-4 shrink-0 rounded-full border" />
                )}
                <span
                  className={
                    isActive
                      ? "text-foreground text-sm font-medium"
                      : isCompleted
                        ? "text-foreground text-sm"
                        : "text-muted-foreground/50 text-sm"
                  }
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6 duration-500">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <KeyRound className="text-primary h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Conectá tu cuenta de ARCA</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Necesitamos tu CUIT y clave fiscal para importar tus datos y automatizar tus deducciones.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="onb-cuit">CUIT</Label>
          <Input
            id="onb-cuit"
            placeholder="XX-XXXXXXXX-X"
            {...form.register("cuit")}
            onChange={handleCuitChange}
          />
          {form.formState.errors.cuit && (
            <p className="text-destructive text-sm">{form.formState.errors.cuit.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="onb-clave">Clave fiscal</Label>
          <div className="relative">
            <Input
              id="onb-clave"
              type={showClave ? "text" : "password"}
              placeholder="Ingresa tu clave fiscal"
              {...form.register("clave")}
            />
            <button
              type="button"
              className="text-muted-foreground/40 hover:text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              onClick={() => setShowClave(!showClave)}
            >
              {showClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.clave && (
            <p className="text-destructive text-sm">{form.formState.errors.clave.message}</p>
          )}
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar y continuar
        </Button>
      </form>

      <div className="text-muted-foreground/50 flex items-start gap-2.5 text-xs">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Tu clave fiscal se encripta con AES-256-GCM antes de guardarse. Nunca se almacena en texto
          plano.
        </p>
      </div>
    </div>
  );
}
