"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User,
  RefreshCw,
  SkipForward,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import { StepProgress } from "@/components/shared/step-progress";
import type { StepDefinition } from "@/lib/automation/job-steps";
import { getStepsForJobType } from "@/lib/automation/job-steps";
import { toast } from "sonner";
import { useEmployerCount } from "@/contexts/employer-count";

const ONBOARDING_PROFILE_STEPS: StepDefinition[] = [
  { key: "login", label: "Iniciando sesión en ARCA" },
  { key: "siradig", label: "Abriendo SiRADIG" },
  { key: "datos_personales", label: "Extrayendo datos personales" },
  { key: "empleadores", label: "Extrayendo empleadores" },
  { key: "cargas_familia", label: "Extrayendo cargas de familia" },
  { key: "casas_particulares", label: "Extrayendo trabajadores domésticos" },
];

// ─── Date helpers (YYYY-MM-DD ↔ DD/MM/YYYY) ─────────────────

function isoToDmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Employer Form Schema ────────────────────────────────────

const employerSchema = z.object({
  cuit: z
    .string()
    .min(1, "Requerido")
    .regex(/^\d{11}$/, "CUIT debe tener 11 dígitos"),
  razonSocial: z.string().min(1, "Requerido"),
  fechaInicio: z.string().min(1, "Requerido"),
  fechaFin: z.string().optional(),
  agenteRetencion: z.boolean(),
});

type EmployerFormData = z.infer<typeof employerSchema>;

interface Props {
  pullProfileJobId: string | null;
  activePushEmployersJobId: string | null;
  onComplete: (hasEmployers: boolean) => void;
}

interface ProfileSummary {
  employers: number;
  familyDependents: number;
  domesticWorkers: number;
  hasPersonalData: boolean;
}

type Phase = "pulling" | "no-employers" | "adding" | "pushing" | "done";

export function OnboardingStepProfile({
  pullProfileJobId,
  activePushEmployersJobId,
  onComplete,
}: Props) {
  const [jobId, setJobId] = useState<string | null>(pullProfileJobId);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("PENDING");
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [retrying, setRetrying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Employer registration state
  const [phase, setPhase] = useState<Phase>("pulling");
  const [employerDialogOpen, setEmployerDialogOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [pushJobId, setPushJobId] = useState<string | null>(activePushEmployersJobId);
  const [pushStep, setPushStep] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const pushEventSourceRef = useRef<EventSource | null>(null);
  const [savedEmployerId, setSavedEmployerId] = useState<string | null>(null);

  const { invalidate: invalidateEmployerCount } = useEmployerCount();

  const fetchSummary = useCallback(async () => {
    const fiscalYear = new Date().getFullYear();
    try {
      const [empRes, famRes, workRes, pdRes] = await Promise.all([
        fetch(`/api/empleadores?year=${fiscalYear}`),
        fetch(`/api/cargas-familia?year=${fiscalYear}`),
        fetch(`/api/trabajadores?fiscalYear=${fiscalYear}&count=true`),
        fetch(`/api/datos-personales?fiscalYear=${fiscalYear}`),
      ]);
      const [empData, famData, workData, pdData] = await Promise.all([
        empRes.json(),
        famRes.json(),
        workRes.json(),
        pdRes.json(),
      ]);
      setSummary({
        employers: empData.employers?.length ?? 0,
        familyDependents: famData.dependents?.length ?? 0,
        domesticWorkers: workData.count ?? 0,
        hasPersonalData: !!pdData.personalData,
      });
    } catch {
      setSummary({ employers: 0, familyDependents: 0, domesticWorkers: 0, hasPersonalData: false });
    }
  }, []);

  const connectToSSE = useCallback(
    (id: string) => {
      eventSourceRef.current?.close();
      const es = new EventSource(`/api/automatizacion/${id}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.step) setCurrentStep(data.step);
          if (data.done) {
            es.close();
            eventSourceRef.current = null;
            if (data.status === "COMPLETED") {
              fetchSummary().then(() => setJobStatus("COMPLETED"));
            } else {
              setJobStatus("FAILED");
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setJobStatus("FAILED");
      };
    },
    [fetchSummary],
  );

  // ── Connect to pull profile job ──
  useEffect(() => {
    if (jobId) {
      fetch(`/api/automatizacion/${jobId}`)
        .then((r) => r.json())
        .then(async (data) => {
          if (data.job?.status === "COMPLETED") {
            await fetchSummary();
            setJobStatus("COMPLETED");
          } else if (data.job?.status === "FAILED") {
            setJobStatus("FAILED");
          } else {
            setJobStatus("RUNNING");
            if (data.job?.currentStep) setCurrentStep(data.job.currentStep);
            connectToSSE(jobId);
          }
        })
        .catch(() => {
          setJobStatus("RUNNING");
          connectToSSE(jobId);
        });
    } else {
      fetchSummary().then(() => setJobStatus("COMPLETED"));
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [jobId, connectToSSE, fetchSummary]);

  // ── Determine phase after profile pull completes ──
  useEffect(() => {
    if (jobStatus === "COMPLETED" && summary) {
      if (summary.employers > 0) {
        // Has employers — auto-advance after a short delay
        setPhase("done");
        const timer = setTimeout(() => onComplete(true), 1500);
        return () => clearTimeout(timer);
      } else if (pushJobId) {
        // Resuming with active push job
        setPhase("pushing");
      } else {
        setPhase("no-employers");
      }
    }
  }, [jobStatus, summary, onComplete, pushJobId]);

  // ── Push job SSE ──
  const connectToPushSSE = useCallback(
    (id: string) => {
      pushEventSourceRef.current?.close();
      const es = new EventSource(`/api/automatizacion/${id}/logs`);
      pushEventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.step) setPushStep(data.step);
          if (data.done) {
            es.close();
            pushEventSourceRef.current = null;
            if (data.status === "COMPLETED") {
              setPushStatus("COMPLETED");
              invalidateEmployerCount();
              setTimeout(() => onComplete(true), 1500);
            } else {
              setPushStatus("FAILED");
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        pushEventSourceRef.current = null;
        setPushStatus("FAILED");
      };
    },
    [onComplete, invalidateEmployerCount],
  );

  // ── Connect to push job (initial or resume) ──
  useEffect(() => {
    if (phase !== "pushing" || !pushJobId) return;

    fetch(`/api/automatizacion/${pushJobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.job?.status === "COMPLETED") {
          setPushStatus("COMPLETED");
          invalidateEmployerCount();
          setTimeout(() => onComplete(true), 1500);
        } else if (data.job?.status === "FAILED") {
          setPushStatus("FAILED");
        } else {
          setPushStatus("RUNNING");
          if (data.job?.currentStep) setPushStep(data.job.currentStep);
          connectToPushSSE(pushJobId);
        }
      })
      .catch(() => {
        setPushStatus("RUNNING");
        connectToPushSSE(pushJobId);
      });

    return () => {
      pushEventSourceRef.current?.close();
    };
  }, [phase, pushJobId, connectToPushSSE, onComplete, invalidateEmployerCount]);

  // ── Handlers ──

  async function handleRetry() {
    setRetrying(true);
    setJobStatus("PENDING");
    setCurrentStep(null);
    setSummary(null);
    setPhase("pulling");
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_PROFILE",
          fiscalYear: new Date().getFullYear(),
        }),
      });
      if (!res.ok) throw new Error();
      const { job } = await res.json();
      setJobId(job.id);
    } catch {
      toast.error("Error al reintentar");
      setJobStatus("FAILED");
    } finally {
      setRetrying(false);
    }
  }

  async function handlePushEmployer(employerId: string) {
    setPhase("pushing");
    setPushStatus("RUNNING");
    setPushStep(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PUSH_EMPLOYERS",
          fiscalYear: new Date().getFullYear(),
          employerId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar");
      }
      const { job } = await res.json();
      setPushJobId(job.id);
      connectToPushSSE(job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar empleador a SiRADIG";
      toast.error(msg);
      setPushStatus("FAILED");
    }
  }

  async function handleRetryPush() {
    if (!savedEmployerId) return;
    setPushStatus(null);
    setPushStep(null);
    await handlePushEmployer(savedEmployerId);
  }

  const isEmpty =
    summary &&
    !summary.hasPersonalData &&
    summary.employers === 0 &&
    summary.familyDependents === 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6 duration-500">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <User className="text-primary h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Importando tu perfil impositivo</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Estamos extrayendo tus datos de ARCA automáticamente.
        </p>
      </div>

      {/* Pull profile progress */}
      {phase === "pulling" && jobStatus !== "COMPLETED" && jobStatus !== "FAILED" && (
        <div className="bg-muted/50 rounded-xl p-4">
          <StepProgress
            steps={ONBOARDING_PROFILE_STEPS}
            currentStep={currentStep}
            status={jobStatus}
          />
        </div>
      )}

      {/* Profile summary (shown when pull completed with data) */}
      {jobStatus === "COMPLETED" && summary && !isEmpty && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Perfil importado
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            {summary.hasPersonalData && <p>Datos personales importados</p>}
            {summary.employers > 0 && (
              <p>
                {summary.employers} empleador{summary.employers > 1 ? "es" : ""}
              </p>
            )}
            {summary.familyDependents > 0 && (
              <p>
                {summary.familyDependents} carga{summary.familyDependents > 1 ? "s" : ""} de familia
              </p>
            )}
            {summary.domesticWorkers > 0 && (
              <p>
                {summary.domesticWorkers} trabajador{summary.domesticWorkers > 1 ? "es" : ""}{" "}
                doméstico{summary.domesticWorkers > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* No employers alert + action buttons */}
      {phase === "no-employers" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                No se encontraron empleadores
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Para poder desgravar tus comprobantes necesitás tener al menos un empleador cargado en
              SiRADIG. Podés agregarlo ahora.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => setEmployerDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar empleador
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground flex-1"
              onClick={() => setSkipDialogOpen(true)}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Continuar sin empleador
            </Button>
          </div>
        </div>
      )}

      {/* Push employer progress */}
      {phase === "pushing" && (
        <div className="space-y-4">
          {pushStatus !== "COMPLETED" && pushStatus !== "FAILED" && (
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-muted-foreground mb-3 text-center text-sm">
                Registrando empleador en SiRADIG...
              </p>
              <StepProgress
                steps={getStepsForJobType("PUSH_EMPLOYERS")}
                currentStep={pushStep}
                status={pushStatus ?? "PENDING"}
              />
            </div>
          )}

          {pushStatus === "COMPLETED" && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Empleador registrado en SiRADIG
                </span>
              </div>
            </div>
          )}

          {pushStatus === "FAILED" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm text-red-700 dark:text-red-400">
                  Hubo un error al registrar el empleador en SiRADIG.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={handleRetryPush}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
                <Button
                  variant="ghost"
                  className="text-muted-foreground flex-1"
                  onClick={() => setSkipDialogOpen(true)}
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Continuar sin empleador
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pull profile failed */}
      {jobStatus === "FAILED" && phase === "pulling" && (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            Hubo un error al importar tu perfil. Podés reintentar o continuar sin importar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reintentar
            </Button>
            <Button className="flex-1" onClick={() => onComplete(false)}>
              <SkipForward className="mr-2 h-4 w-4" />
              Omitir
            </Button>
          </div>
        </div>
      )}

      {/* Employer form dialog */}
      <EmployerFormDialog
        open={employerDialogOpen}
        onOpenChange={setEmployerDialogOpen}
        onSaved={(employerId) => {
          setSavedEmployerId(employerId);
          setEmployerDialogOpen(false);
          handlePushEmployer(employerId);
        }}
      />

      {/* Skip confirmation dialog */}
      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Continuar sin empleador?</AlertDialogTitle>
            <AlertDialogDescription>
              Sin un empleador cargado, no vas a poder desgravar ningún comprobante. Podés agregar
              un empleador después desde{" "}
              <span className="font-medium">Perfil impositivo → Empleadores</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => onComplete(false)}>
              Continuar sin empleador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Employer Form Dialog ────────────────────────────────────

function EmployerFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (employerId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // In onboarding, user has no employers — first one defaults to agente de retención
  const [form, setForm] = useState<EmployerFormData>({
    cuit: "",
    razonSocial: "",
    fechaInicio: "",
    fechaFin: "",
    agenteRetencion: true,
  });
  const lookupAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        cuit: "",
        razonSocial: "",
        fechaInicio: "",
        fechaFin: "",
        agenteRetencion: true,
      });
      setErrors({});
      setLookupDone(false);
    }
  }, [open]);

  // Auto-lookup razón social when CUIT has 11 digits
  useEffect(() => {
    if (form.cuit.length !== 11) {
      setLookupDone(false);
      setForm((f) => ({ ...f, razonSocial: "" }));
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    setLookingUp(true);
    fetch(`/api/cuit-lookup?cuit=${form.cuit}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setForm((f) => ({ ...f, razonSocial: data.razonSocial ?? "" }));
          setLookupDone(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLookupDone(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookingUp(false);
      });

    return () => controller.abort();
     
  }, [form.cuit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = employerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const fiscalYear = new Date().getFullYear();
      const res = await fetch("/api/empleadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result.data,
          fechaInicio: isoToDmy(result.data.fechaInicio),
          fechaFin: result.data.fechaFin ? isoToDmy(result.data.fechaFin) : undefined,
          fiscalYear,
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSaved(json.employer.id);
      toast.success("Empleador guardado");
    } catch {
      toast.error("Error al guardar empleador");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar empleador</DialogTitle>
          <DialogDescription>
            Ingresá los datos de tu empleador para registrarlo en SiRADIG
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="onb-cuit">CUIT</Label>
            <Input
              id="onb-cuit"
              placeholder="20123456789"
              value={form.cuit}
              onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value.replace(/\D/g, "") }))}
              maxLength={11}
              disabled={saving}
            />
            {errors.cuit && <p className="text-xs text-red-500">{errors.cuit}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onb-razonSocial">Razón Social</Label>
            <div className="relative">
              <Input
                id="onb-razonSocial"
                placeholder={lookingUp ? "Buscando..." : "Se completa automáticamente con el CUIT"}
                value={form.razonSocial}
                readOnly
                className="bg-muted"
                disabled={saving}
              />
              {lookingUp && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>
            {errors.razonSocial && <p className="text-xs text-red-500">{errors.razonSocial}</p>}
            {lookupDone && !form.razonSocial && form.cuit.length === 11 && (
              <p className="text-muted-foreground text-xs">
                No se encontró la razón social. Verificá el CUIT.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="onb-fechaInicio">Fecha inicio</Label>
              <Input
                id="onb-fechaInicio"
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                disabled={saving}
              />
              {errors.fechaInicio && <p className="text-xs text-red-500">{errors.fechaInicio}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onb-fechaFin">Fecha fin</Label>
              <Input
                id="onb-fechaFin"
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="onb-agenteRetencion">Agente de retención</Label>
            <Switch
              id="onb-agenteRetencion"
              checked={form.agenteRetencion}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, agenteRetencion: checked }))}
              disabled={saving}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar empleador
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
