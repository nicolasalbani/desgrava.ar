"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, UserRound, Download } from "lucide-react";
import { toast } from "sonner";
import { StepProgress } from "@/components/shared/step-progress";
import { JOB_TYPE_STEPS } from "@/lib/automation/job-steps";
import {
  TIPO_TRABAJO_OPTIONS,
  HORAS_SEMANALES_OPTIONS,
  MODALIDAD_PAGO_OPTIONS,
  MODALIDAD_TRABAJO_OPTIONS,
} from "@/lib/validators/domestic";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCuit } from "@/lib/validators/cuit";

// ── Zod schema ─────────────────────────────────────────────

const schema = z.object({
  cuil: z.string().min(1, "Requerido"),
  apellidoNombre: z.string().min(1, "Requerido"),
  tipoTrabajo: z.string().min(1, "Requerido"),
  domicilioLaboral: z.string().optional(),
  horasSemanales: z.string().optional(),
  condicion: z.string(),
  obraSocial: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  fechaIngreso: z.string().optional(),
  modalidadPago: z.string().optional(),
  modalidadTrabajo: z.string().optional(),
  remuneracionPactada: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const defaultValues: FormData = {
  cuil: "",
  apellidoNombre: "",
  tipoTrabajo: "Personal para tareas generales",
  domicilioLaboral: "",
  horasSemanales: "",
  condicion: "Activo",
  obraSocial: "",
  fechaNacimiento: "",
  fechaIngreso: "",
  modalidadPago: "",
  modalidadTrabajo: "",
  remuneracionPactada: "",
};

// ── Types ───────────────────────────────────────────────────

interface DomesticWorker {
  id: string;
  cuil: string;
  apellidoNombre: string;
  tipoTrabajo: string;
  domicilioLaboral: string | null;
  horasSemanales: string | null;
  condicion: string;
  obraSocial: string | null;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  modalidadPago: string | null;
  modalidadTrabajo: string | null;
  remuneracionPactada: string | null;
  _count?: { receipts: number };
}

// ── Worker form dialog ──────────────────────────────────────

function WorkerDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  fiscalYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: DomesticWorker | null;
  onSaved: (w: DomesticWorker) => void;
  fiscalYear: number;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        cuil: formatCuit(editing.cuil),
        apellidoNombre: editing.apellidoNombre,
        tipoTrabajo: editing.tipoTrabajo,
        domicilioLaboral: editing.domicilioLaboral ?? "",
        horasSemanales: editing.horasSemanales ?? "",
        condicion: editing.condicion,
        obraSocial: editing.obraSocial ?? "",
        fechaNacimiento: editing.fechaNacimiento ?? "",
        fechaIngreso: editing.fechaIngreso ?? "",
        modalidadPago: editing.modalidadPago ?? "",
        modalidadTrabajo: editing.modalidadTrabajo ?? "",
        remuneracionPactada: editing.remuneracionPactada ?? "",
      });
    } else {
      form.reset(defaultValues);
    }
  }, [open, editing, form]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const url = editing ? `/api/trabajadores/${editing.id}` : "/api/trabajadores";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fiscalYear,
          remuneracionPactada: data.remuneracionPactada
            ? parseFloat(data.remuneracionPactada)
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }
      const json = await res.json();
      onSaved(json.worker);
      onOpenChange(false);
      toast.success(editing ? "Trabajador actualizado" : "Trabajador agregado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar trabajador" : "Agregar trabajador"}</DialogTitle>
          <DialogDescription>Datos del trabajador de casas particulares.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* CUIL + Nombre */}
          <div className="space-y-1.5">
            <Label>CUIL</Label>
            <Input {...form.register("cuil")} placeholder="XX-XXXXXXXX-X" className="w-44" />
            {form.formState.errors.cuil && (
              <p className="text-destructive text-xs">{form.formState.errors.cuil.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Apellido y Nombre</Label>
            <Input {...form.register("apellidoNombre")} placeholder="Apellido y nombre completo" />
            {form.formState.errors.apellidoNombre && (
              <p className="text-destructive text-xs">
                {form.formState.errors.apellidoNombre.message}
              </p>
            )}
          </div>

          {/* Tipo de Trabajo */}
          <div className="space-y-1.5">
            <Label>Tipo de trabajo</Label>
            <Controller
              control={form.control}
              name="tipoTrabajo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_TRABAJO_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Horas semanales */}
          <div className="space-y-1.5">
            <Label>
              Horas semanales{" "}
              <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
            </Label>
            <Controller
              control={form.control}
              name="horasSemanales"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HORAS_SEMANALES_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Modalidad de trabajo */}
          <div className="space-y-1.5">
            <Label>
              Modalidad de trabajo{" "}
              <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
            </Label>
            <Controller
              control={form.control}
              name="modalidadTrabajo"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDAD_TRABAJO_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="border-border border-t" />

          {/* Fecha ingreso + Modalidad pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Fecha de ingreso{" "}
                <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
              </Label>
              <Input
                {...form.register("fechaIngreso")}
                placeholder="dd/mm/aaaa"
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Modalidad de pago{" "}
                <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
              </Label>
              <Controller
                control={form.control}
                name="modalidadPago"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDAD_PAGO_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Remuneracion + Domicilio */}
          <div className="space-y-1.5">
            <Label>
              Remuneracion pactada{" "}
              <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
            </Label>
            <Input {...form.register("remuneracionPactada")} placeholder="0.00" className="w-40" />
          </div>

          <div className="space-y-1.5">
            <Label>
              Domicilio laboral{" "}
              <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
            </Label>
            <Input {...form.register("domicilioLaboral")} placeholder="Direccion" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main section ────────────────────────────────────────────

export function DomesticWorkersSection({ fiscalYear }: { fiscalYear: number }) {
  const [workers, setWorkers] = useState<DomesticWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DomesticWorker | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import from ARCA state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<string | null>(null);
  const [skippedWorkers, setSkippedWorkers] = useState(false);
  const skippedArcaRef = useRef<string[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Map<string, "created" | "updated">>(
    new Map(),
  );
  const eventSourceRef = useRef<EventSource | null>(null);
  const workersRef = useRef<DomesticWorker[]>([]);

  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  const connectToJobSSE = useCallback(
    (jobId: string) => {
      eventSourceRef.current?.close();

      const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.step) setImportStep(data.step);
          if (data.done) {
            es.close();
            eventSourceRef.current = null;

            if (data.status === "COMPLETED") {
              fetch(`/api/trabajadores?fiscalYear=${fiscalYear}`)
                .then((r) => r.json())
                .then((d) => {
                  const newWorkers: DomesticWorker[] = d.workers ?? [];
                  const oldCuils = new Set(workersRef.current.map((w) => w.cuil));
                  const highlights = new Map<string, "created" | "updated">();
                  for (const w of newWorkers) {
                    if (!oldCuils.has(w.cuil)) {
                      highlights.set(w.id, "created");
                    } else {
                      const old = workersRef.current.find((ow) => ow.cuil === w.cuil);
                      if (old && JSON.stringify(old) !== JSON.stringify(w)) {
                        highlights.set(w.id, "updated");
                      }
                    }
                  }
                  setWorkers(newWorkers);
                  setHighlightedIds(highlights);
                  setTimeout(() => setHighlightedIds(new Map()), 3000);
                });
              toast.success("Trabajadores importados desde ARCA");
            } else {
              toast.error("Error al importar trabajadores");
            }
            setImporting(false);
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setImporting(false);
        toast.error("Se perdio la conexion con el servidor");
      };
    },
    [fiscalYear],
  );

  useEffect(() => {
    setLoading(true);
    fetch(`/api/trabajadores?fiscalYear=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setWorkers(d.workers ?? []))
      .catch(() => toast.error("Error al cargar trabajadores"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  // Fetch skip preference
  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const arr: string[] = data.preference?.skippedArcaDialogs ?? [];
        skippedArcaRef.current = arr;
        setSkippedWorkers(arr.includes("import-workers"));
      })
      .catch(() => {});
  }, []);

  // Check for active import job on mount
  useEffect(() => {
    let cancelled = false;
    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_DOMESTIC_WORKERS" &&
            j.fiscalYear === fiscalYear &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setImporting(true);
          if (activeJob.currentStep) {
            setImportStep(activeJob.currentStep);
          }
          connectToJobSSE(activeJob.id);
        }
      } catch {
        // Best-effort
      }
    }
    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear, connectToJobSSE]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(w: DomesticWorker) {
    setEditing(w);
    setDialogOpen(true);
  }

  function handleSaved(w: DomesticWorker) {
    setWorkers((prev) => {
      const idx = prev.findIndex((d) => d.id === w.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = w;
        return next;
      }
      return [...prev, w];
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/trabajadores/${deleteId}`, { method: "DELETE" });
      setWorkers((prev) => prev.filter((w) => w.id !== deleteId));
      toast.success("Trabajador eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const handleImportFromArca = useCallback(async () => {
    setImporting(true);
    setImportStep(null);
    setHighlightedIds(new Map());

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_DOMESTIC_WORKERS",
          fiscalYear,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar importacion");
      }

      const { job } = await res.json();
      connectToJobSSE(job.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
      setImporting(false);
    }
  }, [fiscalYear, connectToJobSSE]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar trabajador
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportDialogOpen(true)}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Importar desde ARCA
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
        </div>
      ) : workers.length === 0 && !importing ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
            <UserRound className="text-muted-foreground/50 h-5 w-5" />
          </div>
          <p className="text-muted-foreground/60 text-sm">No registraste trabajadores todavia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workers.map((w) => {
            const highlight = highlightedIds.get(w.id);
            let cardClass = "border-border bg-muted/20";
            if (highlight === "created") {
              cardClass = "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30";
            } else if (highlight === "updated") {
              cardClass = "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30";
            }

            return (
              <div
                key={w.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-700 ${cardClass}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{w.apellidoNombre}</p>
                    {highlight === "created" && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
                        nuevo
                      </span>
                    )}
                    {highlight === "updated" && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                        actualizado
                      </span>
                    )}
                    {w.condicion !== "Activo" && (
                      <span className="text-muted-foreground rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-red-900/50">
                        {w.condicion}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground/60 mt-0.5 text-xs">
                    CUIL {formatCuit(w.cuil)} · {w.tipoTrabajo}
                    {w.horasSemanales ? ` · ${w.horasSemanales}` : ""}
                    {w._count?.receipts ? ` · ${w._count.receipts} recibos` : ""}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                    onClick={() => openEdit(w)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => setDeleteId(w.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import progress */}
      {importing && (
        <div className="border-border bg-muted rounded-xl border p-4">
          <StepProgress
            steps={JOB_TYPE_STEPS.PULL_DOMESTIC_WORKERS}
            currentStep={importStep}
            status="RUNNING"
          />
        </div>
      )}

      <ImportWorkersArcaDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onConfirm={() => {
          setImportDialogOpen(false);
          handleImportFromArca();
        }}
        skipped={skippedWorkers}
        skippedArcaRef={skippedArcaRef}
        onSkipChange={setSkippedWorkers}
      />

      <WorkerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={handleSaved}
        fiscalYear={fiscalYear}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar trabajador</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara este trabajador y sus recibos asociados. Esta accion no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ImportWorkersArcaDialog({
  open,
  onOpenChange,
  onConfirm,
  skipped,
  skippedArcaRef,
  onSkipChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  skipped: boolean;
  skippedArcaRef: React.RefObject<string[]>;
  onSkipChange: (v: boolean) => void;
}) {
  // Auto-confirm when skip preference is enabled
  useEffect(() => {
    if (open && skipped) {
      onConfirm();
    }
  }, [open]);

  async function saveSkipPreference(checked: boolean) {
    onSkipChange(checked);
    const key = "import-workers";
    const updated = checked
      ? [...skippedArcaRef.current.filter((k) => k !== key), key]
      : skippedArcaRef.current.filter((k) => k !== key);
    skippedArcaRef.current = updated;
    try {
      await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skippedArcaDialogs: updated }),
      });
    } catch {
      // Silently fail
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar trabajadores desde ARCA</DialogTitle>
          <DialogDescription>
            Se conectara a Personal de Casas Particulares y descargara los datos de todos los
            trabajadores registrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="bg-muted/40 rounded-xl p-4 text-sm">
            <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
            <ul className="text-muted-foreground space-y-1.5 text-xs">
              <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
              <li>2. Ir a &quot;Personal de Casas Particulares&quot;</li>
              <li>3. Importar los datos de cada trabajador registrado</li>
            </ul>
            <p className="text-muted-foreground/70 mt-3 text-xs">
              Los trabajadores que ya tengas cargados se van a actualizar con los datos mas
              recientes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="skip-workers-import"
              checked={skipped}
              onCheckedChange={(checked) => saveSkipPreference(checked === true)}
            />
            <label
              htmlFor="skip-workers-import"
              className="text-muted-foreground cursor-pointer text-xs"
            >
              No volver a mostrar este mensaje
            </label>
          </div>
          <Button onClick={onConfirm} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Iniciar importacion
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
