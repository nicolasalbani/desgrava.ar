"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Users,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────

const TIPO_DOC_OPTIONS = ["CUIT", "CUIL", "CDI", "DNI", "LC", "LE"] as const;

const PARENTESCO_OPTIONS = [
  { value: "1", label: "Cónyuge" },
  { value: "3", label: "Hijo/a menor de 18 años" },
  { value: "30", label: "Hijastro/a menor de 18 años" },
  { value: "31", label: "Hijo/a incapacitado para el trabajo" },
  { value: "32", label: "Hijastro/a incapacitado para el trabajo" },
  { value: "51", label: "Unión convivencial" },
] as const;

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const UNION_PARENTESCOS = new Set(["1", "51"]);
const HIJO_PARENTESCOS = new Set(["3", "30", "31", "32"]);

function parentescoLabel(value: string) {
  return PARENTESCO_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

function unionDateLabel(parentesco: string) {
  return parentesco === "1" ? "Fecha de Casamiento" : "Fecha de Unión Convivencial";
}

// ── Zod schema ───────────────────────────────────────────────────

const schema = z.object({
  tipoDoc: z.enum(["CUIT", "CUIL", "CDI", "DNI", "LC", "LE"]),
  numeroDoc: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  nombre: z.string().min(1, "Requerido"),
  fechaNacimiento: z.string().optional(),
  parentesco: z.enum(["1", "3", "30", "31", "32", "51"]),
  fechaUnion: z.string().optional(),
  porcentajeDed: z.string().optional(),
  cuitOtroDed: z.string().optional(),
  familiaCargo: z.boolean(),
  residente: z.boolean(),
  tieneIngresos: z.boolean(),
  montoIngresos: z.string().optional(),
  mesDesde: z.number().int().min(1).max(12),
  mesHasta: z.number().int().min(1).max(12),
  proximosPeriodos: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const defaultValues: FormData = {
  tipoDoc: "DNI",
  numeroDoc: "",
  apellido: "",
  nombre: "",
  fechaNacimiento: "",
  parentesco: "3",
  fechaUnion: "",
  porcentajeDed: "",
  cuitOtroDed: "",
  familiaCargo: true,
  residente: true,
  tieneIngresos: false,
  montoIngresos: "",
  mesDesde: 1,
  mesHasta: 12,
  proximosPeriodos: true,
};

// ── Types ────────────────────────────────────────────────────────

interface FamilyDependent {
  id: string;
  tipoDoc: string;
  numeroDoc: string;
  apellido: string;
  nombre: string;
  fechaNacimiento: string | null;
  parentesco: string;
  fechaUnion: string | null;
  porcentajeDed: string | null;
  cuitOtroDed: string | null;
  familiaCargo: boolean;
  residente: boolean;
  tieneIngresos: boolean;
  montoIngresos: string | null;
  mesDesde: number;
  mesHasta: number;
  proximosPeriodos: boolean;
}

// ── Dependent form dialog ────────────────────────────────────────

function DependentDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  fiscalYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FamilyDependent | null;
  onSaved: (dep: FamilyDependent) => void;
  fiscalYear: number;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [saving, setSaving] = useState(false);

  const parentesco = form.watch("parentesco");
  const tieneIngresos = form.watch("tieneIngresos");
  const porcentajeDed = form.watch("porcentajeDed");
  const mesHasta = form.watch("mesHasta");

  const isUnion = UNION_PARENTESCOS.has(parentesco);
  const isHijo = HIJO_PARENTESCOS.has(parentesco);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        tipoDoc: editing.tipoDoc as FormData["tipoDoc"],
        numeroDoc: editing.numeroDoc,
        apellido: editing.apellido,
        nombre: editing.nombre,
        fechaNacimiento: editing.fechaNacimiento ?? "",
        parentesco: editing.parentesco as FormData["parentesco"],
        fechaUnion: editing.fechaUnion ?? "",
        porcentajeDed: editing.porcentajeDed ?? "",
        cuitOtroDed: editing.cuitOtroDed ?? "",
        familiaCargo: editing.familiaCargo,
        residente: editing.residente,
        tieneIngresos: editing.tieneIngresos,
        montoIngresos: editing.montoIngresos ?? "",
        mesDesde: editing.mesDesde,
        mesHasta: editing.mesHasta,
        proximosPeriodos: editing.proximosPeriodos,
      });
    } else {
      form.reset(defaultValues);
    }
  }, [open, editing, form]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const url = editing ? `/api/cargas-familia/${editing.id}` : "/api/cargas-familia";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, fiscalYear }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSaved(json.dependent);
      onOpenChange(false);
      toast.success(editing ? "Carga actualizada" : "Carga agregada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar carga de familia" : "Agregar carga de familia"}
          </DialogTitle>
          <DialogDescription>
            Declará un familiar a cargo para deducir en SiRADIG.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* Parentesco */}
          <div className="space-y-1.5">
            <Label>Parentesco</Label>
            <Controller
              control={form.control}
              name="parentesco"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENTESCO_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Documento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo documento</Label>
              <Controller
                control={form.control}
                name="tipoDoc"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_DOC_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Nro. documento</Label>
              <Input {...form.register("numeroDoc")} placeholder="Nro. documento" />
              {form.formState.errors.numeroDoc && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.numeroDoc.message}
                </p>
              )}
            </div>
          </div>

          {/* Apellido / Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input {...form.register("apellido")} placeholder="Apellido" />
              {form.formState.errors.apellido && (
                <p className="text-destructive text-xs">{form.formState.errors.apellido.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input {...form.register("nombre")} placeholder="Nombre" />
              {form.formState.errors.nombre && (
                <p className="text-destructive text-xs">{form.formState.errors.nombre.message}</p>
              )}
            </div>
          </div>

          {/* Fecha nacimiento */}
          <div className="space-y-1.5">
            <Label>
              Fecha de nacimiento{" "}
              <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
            </Label>
            <Input
              {...form.register("fechaNacimiento")}
              placeholder="dd/mm/aaaa"
              className="w-40"
            />
          </div>

          {/* Conditional: fecha unión */}
          {isUnion && (
            <div className="space-y-1.5">
              <Label>{unionDateLabel(parentesco)}</Label>
              <Input {...form.register("fechaUnion")} placeholder="dd/mm/aaaa" className="w-40" />
            </div>
          )}

          {/* Conditional: porcentaje deducción */}
          {isHijo && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Porcentaje de deducción</Label>
                <Controller
                  control={form.control}
                  name="porcentajeDed"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100%</SelectItem>
                        <SelectItem value="50">50% (ambos padres deducen)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {porcentajeDed === "50" && (
                <div className="space-y-1.5">
                  <Label>CUIL/CUIT del otro padre que también deduce</Label>
                  <Input
                    {...form.register("cuitOtroDed")}
                    placeholder="XX-XXXXXXXX-X"
                    className="w-44"
                  />
                </div>
              )}
            </div>
          )}

          <div className="border-border border-t" />

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="familiaCargo">¿Está a cargo?</Label>
              </div>
              <Controller
                control={form.control}
                name="familiaCargo"
                render={({ field }) => (
                  <Switch
                    id="familiaCargo"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="residente">¿Residente en el país?</Label>
              </div>
              <Controller
                control={form.control}
                name="residente"
                render={({ field }) => (
                  <Switch id="residente" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="tieneIngresos">¿Obtuvo ingresos en el período?</Label>
              </div>
              <Controller
                control={form.control}
                name="tieneIngresos"
                render={({ field }) => (
                  <Switch
                    id="tieneIngresos"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            {tieneIngresos && (
              <div className="space-y-1.5">
                <Label>Monto anual de ingresos</Label>
                <Input {...form.register("montoIngresos")} placeholder="0.00" className="w-40" />
              </div>
            )}
          </div>

          <div className="border-border border-t" />

          {/* Período */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Mes desde</Label>
                <Controller
                  control={form.control}
                  name="mesDesde"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {mes}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Mes hasta</Label>
                <Controller
                  control={form.control}
                  name="mesHasta"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {mes}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {mesHasta === 12 && (
              <div className="flex items-center justify-between">
                <Label htmlFor="proximosPeriodos" className="text-muted-foreground/80 text-xs">
                  Vigente para los próximos períodos fiscales
                </Label>
                <Controller
                  control={form.control}
                  name="proximosPeriodos"
                  render={({ field }) => (
                    <Switch
                      id="proximosPeriodos"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
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

// ── Main section ─────────────────────────────────────────────────

export function FamilyDependentsSection({ fiscalYear }: { fiscalYear: number }) {
  const [dependents, setDependents] = useState<FamilyDependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyDependent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import from SiRADIG state
  const [importing, setImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Map<string, "created" | "updated">>(
    new Map(),
  );
  const eventSourceRef = useRef<EventSource | null>(null);
  const dependentsRef = useRef<FamilyDependent[]>([]);

  // Per-dependent export state
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportResults, setExportResults] = useState<
    Map<string, { status: "success" | "failed"; error?: string }>
  >(new Map());
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const exportEventSourceRef = useRef<EventSource | null>(null);

  // Keep ref in sync for use in SSE callbacks
  useEffect(() => {
    dependentsRef.current = dependents;
  }, [dependents]);

  // Connect to SSE for a given job and handle completion
  const connectToJobSSE = useCallback(
    (jobId: string) => {
      eventSourceRef.current?.close();

      const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.log) {
            setImportLogs((prev) => [...prev, data.log]);
          }
          if (data.status) {
            setImportStatus(data.status);
          }
          if (data.done) {
            es.close();
            eventSourceRef.current = null;

            if (data.status === "COMPLETED") {
              fetch(`/api/cargas-familia?year=${fiscalYear}`)
                .then((r) => r.json())
                .then((d) => {
                  const newDeps: FamilyDependent[] = d.dependents ?? [];
                  const oldDocNums = new Set(dependentsRef.current.map((dep) => dep.numeroDoc));
                  const highlights = new Map<string, "created" | "updated">();
                  for (const dep of newDeps) {
                    if (!oldDocNums.has(dep.numeroDoc)) {
                      highlights.set(dep.id, "created");
                    } else {
                      const old = dependentsRef.current.find(
                        (dd) => dd.numeroDoc === dep.numeroDoc,
                      );
                      if (old && JSON.stringify(old) !== JSON.stringify(dep)) {
                        highlights.set(dep.id, "updated");
                      }
                    }
                  }
                  setDependents(newDeps);
                  setHighlightedIds(highlights);
                  setTimeout(() => setHighlightedIds(new Map()), 3000);
                });

              toast.success("Cargas de familia importadas desde SiRADIG");
            } else {
              toast.error("Error al importar cargas de familia");
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
        setImportStatus("FAILED");
        toast.error("Se perdio la conexion con el servidor");
      };
    },
    [fiscalYear],
  );

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cargas-familia?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setDependents(d.dependents ?? []))
      .catch(() => toast.error("Error al cargar las cargas de familia"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  // On mount, check for an active PULL_FAMILY_DEPENDENTS job and reconnect
  useEffect(() => {
    let cancelled = false;

    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_FAMILY_DEPENDENTS" &&
            j.fiscalYear === fiscalYear &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setImporting(true);
          // Restore existing logs from DB
          if (Array.isArray(activeJob.logs) && activeJob.logs.length > 0) {
            setImportLogs(activeJob.logs);
          }
          setImportStatus(activeJob.status);
          connectToJobSSE(activeJob.id);
        }
      } catch {
        // Best-effort; don't block the page
      }
    }

    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear, connectToJobSSE]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(dep: FamilyDependent) {
    setEditing(dep);
    setDialogOpen(true);
  }

  function handleSaved(dep: FamilyDependent) {
    setDependents((prev) => {
      const idx = prev.findIndex((d) => d.id === dep.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = dep;
        return next;
      }
      return [...prev, dep];
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/cargas-familia/${deleteId}`, { method: "DELETE" });
      setDependents((prev) => prev.filter((d) => d.id !== deleteId));
      toast.success("Carga eliminada");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  // Connect to SSE for a per-dependent export job
  const connectToExportJobSSE = useCallback((jobId: string, dependentId: string) => {
    exportEventSourceRef.current?.close();

    const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
    exportEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.log) {
          setExportLogs((prev) => [...prev, data.log]);
        }
        if (data.done) {
          es.close();
          exportEventSourceRef.current = null;
          setExportingId(null);

          if (data.status === "COMPLETED") {
            // Fetch result to check for per-dependent failures
            fetch(`/api/automatizacion/${jobId}`)
              .then((r) => r.json())
              .then((jobData) => {
                const result = jobData.job?.resultData;
                const failedArr = Array.isArray(result?.failed) ? result.failed : [];
                if (failedArr.length > 0) {
                  const errorMsg = failedArr[0]?.error ?? "Error de validacion en SiRADIG";
                  setExportResults((prev) => {
                    const next = new Map(prev);
                    next.set(dependentId, { status: "failed", error: errorMsg });
                    return next;
                  });
                  toast.error(`Error al exportar: ${errorMsg}`);
                } else {
                  setExportResults((prev) => {
                    const next = new Map(prev);
                    next.set(dependentId, { status: "success" });
                    return next;
                  });
                  toast.success("Carga exportada a SiRADIG");
                }
              })
              .catch(() => {
                setExportResults((prev) => {
                  const next = new Map(prev);
                  next.set(dependentId, { status: "success" });
                  return next;
                });
                toast.success("Carga exportada a SiRADIG");
              });
          } else {
            // FAILED status
            fetch(`/api/automatizacion/${jobId}`)
              .then((r) => r.json())
              .then((jobData) => {
                const errorMsg = jobData.job?.errorMessage ?? "Error al exportar carga de familia";
                setExportResults((prev) => {
                  const next = new Map(prev);
                  next.set(dependentId, { status: "failed", error: errorMsg });
                  return next;
                });
                toast.error(errorMsg);
              })
              .catch(() => {
                setExportResults((prev) => {
                  const next = new Map(prev);
                  next.set(dependentId, { status: "failed", error: "Error desconocido" });
                  return next;
                });
                toast.error("Error al exportar carga de familia");
              });
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      exportEventSourceRef.current = null;
      setExportingId(null);
      setExportResults((prev) => {
        const next = new Map(prev);
        next.set(dependentId, { status: "failed", error: "Se perdio la conexion con el servidor" });
        return next;
      });
      toast.error("Se perdio la conexion con el servidor");
    };
  }, []);

  // On mount, check for an active PUSH_FAMILY_DEPENDENTS job and reconnect
  useEffect(() => {
    let cancelled = false;

    async function checkActiveExportJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: {
            jobType: string;
            fiscalYear?: number | null;
            familyDependentId?: string | null;
            status: string;
          }) =>
            j.jobType === "PUSH_FAMILY_DEPENDENTS" &&
            j.fiscalYear === fiscalYear &&
            j.familyDependentId &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setExportingId(activeJob.familyDependentId);
          if (Array.isArray(activeJob.logs) && activeJob.logs.length > 0) {
            setExportLogs(activeJob.logs);
          }
          connectToExportJobSSE(activeJob.id, activeJob.familyDependentId);
        }
      } catch {
        // Best-effort
      }
    }

    checkActiveExportJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear, connectToExportJobSSE]);

  // Clean up export SSE on unmount
  useEffect(() => {
    return () => {
      exportEventSourceRef.current?.close();
    };
  }, []);

  const handleExportDependent = useCallback(
    async (dependentId: string) => {
      setExportingId(dependentId);
      setExportLogs([]);
      // Clear previous result for this dependent
      setExportResults((prev) => {
        const next = new Map(prev);
        next.delete(dependentId);
        return next;
      });

      try {
        const res = await fetch("/api/automatizacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType: "PUSH_FAMILY_DEPENDENTS",
            fiscalYear,
            familyDependentId: dependentId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al iniciar exportacion");
        }

        const { job } = await res.json();
        connectToExportJobSSE(job.id, dependentId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error al exportar";
        toast.error(errorMsg);
        setExportingId(null);
        setExportResults((prev) => {
          const next = new Map(prev);
          next.set(dependentId, { status: "failed", error: errorMsg });
          return next;
        });
      }
    },
    [fiscalYear, connectToExportJobSSE],
  );

  const handleImportFromSiradig = useCallback(async () => {
    setImporting(true);
    setImportLogs([]);
    setImportStatus(null);
    setHighlightedIds(new Map());

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_FAMILY_DEPENDENTS",
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

  const isExporting = exportingId !== null;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
        </div>
      ) : dependents.length === 0 && !importing ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
            <Users className="text-muted-foreground/50 h-5 w-5" />
          </div>
          <p className="text-muted-foreground/60 text-sm">
            No declaraste cargas de familia todavia.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dependents.map((dep) => {
            const highlight = highlightedIds.get(dep.id);
            const exportResult = exportResults.get(dep.id);
            const isThisExporting = exportingId === dep.id;

            // Determine card styling based on state priority:
            // exporting animation > export result > import highlight > default
            let cardClass = "border-border bg-muted/20";
            if (isThisExporting) {
              cardClass =
                "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 animate-pulse";
            } else if (exportResult?.status === "success") {
              cardClass = "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30";
            } else if (exportResult?.status === "failed") {
              cardClass = "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30";
            } else if (highlight === "created") {
              cardClass = "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30";
            } else if (highlight === "updated") {
              cardClass = "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30";
            }

            return (
              <div key={dep.id}>
                <div
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-700 ${cardClass}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {dep.apellido}, {dep.nombre}
                      </p>
                      {isThisExporting && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                          exportando...
                        </span>
                      )}
                      {!isThisExporting && exportResult?.status === "success" && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
                          exportado
                        </span>
                      )}
                      {!isThisExporting && exportResult?.status === "failed" && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/50 dark:text-red-400">
                          error
                        </span>
                      )}
                      {highlight === "created" && !exportResult && !isThisExporting && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
                          nuevo
                        </span>
                      )}
                      {highlight === "updated" && !exportResult && !isThisExporting && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                          actualizado
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground/60 mt-0.5 text-xs">
                      {parentescoLabel(dep.parentesco)} · {dep.tipoDoc} {dep.numeroDoc}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1">
                    {/* Export to SiRADIG button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        exportResult?.status === "success"
                          ? "text-green-600 dark:text-green-400"
                          : exportResult?.status === "failed"
                            ? "text-red-500 dark:text-red-400"
                            : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleExportDependent(dep.id)}
                      disabled={isExporting || importing}
                      title="Exportar a SiRADIG"
                    >
                      {isThisExporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : exportResult?.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : exportResult?.status === "failed" ? (
                        <AlertCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8"
                      onClick={() => openEdit(dep)}
                      disabled={isThisExporting}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => setDeleteId(dep.id)}
                      disabled={isThisExporting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Per-dependent error message */}
                {!isThisExporting && exportResult?.status === "failed" && exportResult.error && (
                  <div className="mx-4 mt-1 mb-1 flex items-start gap-1.5 rounded-lg bg-red-100/60 px-3 py-2 dark:bg-red-900/30">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500 dark:text-red-400" />
                    <p className="text-xs text-red-600 dark:text-red-400">{exportResult.error}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import progress */}
      {importing && (
        <div className="border-border bg-muted rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-medium">Importando desde SiRADIG...</span>
            {importStatus && (
              <span className="text-muted-foreground text-xs">({importStatus})</span>
            )}
          </div>
          {importLogs.length > 0 && (
            <div className="bg-card max-h-32 overflow-y-auto rounded-lg p-2">
              {importLogs.slice(-8).map((log, i) => (
                <p key={i} className="text-muted-foreground text-xs leading-relaxed">
                  {log}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export progress log (shown below cards while any dependent is exporting) */}
      {isExporting && exportLogs.length > 0 && (
        <div className="border-border bg-muted rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-medium">Exportando a SiRADIG...</span>
          </div>
          <div className="bg-card max-h-32 overflow-y-auto rounded-lg p-2">
            {exportLogs.slice(-8).map((log, i) => (
              <p key={i} className="text-muted-foreground text-xs leading-relaxed">
                {log}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar carga de familia
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportFromSiradig}
          disabled={importing || isExporting}
        >
          {importing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Importar desde SiRADIG
        </Button>
      </div>

      <DependentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={handleSaved}
        fiscalYear={fiscalYear}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar carga de familia</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara esta carga de familia. Esta accion no se puede deshacer.
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
