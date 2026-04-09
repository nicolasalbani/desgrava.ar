"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Download,
  Upload,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Building2,
} from "lucide-react";
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
import { toast } from "sonner";
import { formatCuit } from "@/lib/validators/cuit";
import { getStepsForJobType } from "@/lib/automation/job-steps";

// ─── Types ───────────────────────────────────────────────────

interface Employer {
  id: string;
  cuit: string;
  razonSocial: string;
  fechaInicio: string;
  fechaFin: string | null;
  agenteRetencion: boolean;
  fiscalYear: number;
  createdAt: string;
}

// ─── Date helpers (YYYY-MM-DD ↔ DD/MM/YYYY) ─────────────────

function dmyToIso(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m}-${d}`;
}

function isoToDmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Form Schema ─────────────────────────────────────────────

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

// ─── Form Dialog ─────────────────────────────────────────────

function EmployerFormDialog({
  open,
  onOpenChange,
  editing,
  fiscalYear,
  onSaved,
  hasAgenteRetencion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Employer | null;
  fiscalYear: number;
  onSaved: (employer: Employer) => void;
  hasAgenteRetencion: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<EmployerFormData>({
    cuit: "",
    razonSocial: "",
    fechaInicio: "",
    fechaFin: "",
    agenteRetencion: false,
  });
  const lookupAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          cuit: editing.cuit,
          razonSocial: editing.razonSocial,
          fechaInicio: editing.fechaInicio ? dmyToIso(editing.fechaInicio) : "",
          fechaFin: editing.fechaFin ? dmyToIso(editing.fechaFin) : "",
          agenteRetencion: editing.agenteRetencion,
        });
        setLookupDone(true);
      } else {
        setForm({
          cuit: "",
          razonSocial: "",
          fechaInicio: "",
          fechaFin: "",
          agenteRetencion: !hasAgenteRetencion,
        });
        setLookupDone(false);
      }
      setErrors({});
    }
  }, [open, editing]);

  // Auto-lookup razón social when CUIT has 11 digits (only for new employers)
  useEffect(() => {
    if (editing) return;
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
        if (!controller.signal.aborted) setLookupDone(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookingUp(false);
      });

    return () => controller.abort();
     
  }, [form.cuit, editing]);

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
      const url = editing ? `/api/empleadores/${editing.id}` : "/api/empleadores";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
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
      onSaved(json.employer);
      onOpenChange(false);
      toast.success(editing ? "Empleador actualizado" : "Empleador agregado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar empleador" : "Agregar empleador"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos del empleador"
              : "Ingresa los datos del empleador para el periodo fiscal"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cuit">CUIT</Label>
            <Input
              id="cuit"
              placeholder="20123456789"
              value={form.cuit}
              onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value.replace(/\D/g, "") }))}
              maxLength={11}
              disabled={saving}
            />
            {errors.cuit && <p className="text-xs text-red-500">{errors.cuit}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="razonSocial">Razón Social</Label>
            <div className="relative">
              <Input
                id="razonSocial"
                placeholder={
                  lookingUp
                    ? "Buscando..."
                    : editing
                      ? "Nombre del empleador"
                      : "Se completa automáticamente con el CUIT"
                }
                value={form.razonSocial}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                disabled={saving}
                onChange={
                  editing
                    ? (e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))
                    : undefined
                }
              />
              {lookingUp && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>
            {errors.razonSocial && <p className="text-xs text-red-500">{errors.razonSocial}</p>}
            {!editing && lookupDone && !form.razonSocial && form.cuit.length === 11 && (
              <p className="text-muted-foreground text-xs">
                No se encontró la razón social. Verificá el CUIT.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fechaInicio">Fecha inicio</Label>
              <Input
                id="fechaInicio"
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                disabled={saving}
              />
              {errors.fechaInicio && <p className="text-xs text-red-500">{errors.fechaInicio}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaFin">Fecha fin</Label>
              <Input
                id="fechaFin"
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="agenteRetencion">Agente de retención</Label>
            <Switch
              id="agenteRetencion"
              checked={form.agenteRetencion}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, agenteRetencion: checked }))}
              disabled={saving}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Guardar cambios" : "Agregar empleador"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Section ────────────────────────────────────────────

export function EmployersSection({
  fiscalYear,
  readOnly,
  profileImporting,
  refreshKey,
}: {
  fiscalYear: number;
  readOnly?: boolean;
  profileImporting?: boolean;
  refreshKey?: number;
}) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Map<string, "created" | "updated">>(
    new Map(),
  );

  // Export state
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportResults, setExportResults] = useState<
    Map<string, { status: "success" | "failed"; error?: string }>
  >(new Map());
  const [exportStep, setExportStep] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const exportEventSourceRef = useRef<EventSource | null>(null);
  const employersRef = useRef<Employer[]>([]);

  const isExporting = exportingId !== null;

  // Keep ref in sync
  useEffect(() => {
    employersRef.current = employers;
  }, [employers]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      exportEventSourceRef.current?.close();
    };
  }, []);

  // ── Data loading ──
  useEffect(() => {
    setLoading(true);
    fetch(`/api/empleadores?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setEmployers(d.employers ?? []))
      .catch(() => toast.error("Error al cargar empleadores"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  // Re-fetch when compound import completes
  useEffect(() => {
    if (!refreshKey) return;
    fetch(`/api/empleadores?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setEmployers(d.employers ?? []));
  }, [refreshKey, fiscalYear]);

  // ── SSE for import ──
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
              fetch(`/api/empleadores?year=${fiscalYear}`)
                .then((r) => r.json())
                .then((d) => {
                  const newEmps: Employer[] = d.employers ?? [];
                  const oldCuits = new Set(employersRef.current.map((e) => e.cuit));
                  const highlights = new Map<string, "created" | "updated">();

                  for (const emp of newEmps) {
                    if (!oldCuits.has(emp.cuit)) {
                      highlights.set(emp.id, "created");
                    } else {
                      const old = employersRef.current.find((e) => e.cuit === emp.cuit);
                      if (old && JSON.stringify(old) !== JSON.stringify(emp)) {
                        highlights.set(emp.id, "updated");
                      }
                    }
                  }
                  setEmployers(newEmps);
                  setHighlightedIds(highlights);
                  setTimeout(() => setHighlightedIds(new Map()), 3000);
                });

              toast.success("Empleadores importados desde SiRADIG");
            } else {
              toast.error("Error al importar empleadores");
            }
            setImporting(false);
            setImportStep(null);
          }
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setImporting(false);
        setImportStep(null);
        toast.error("Se perdió la conexión con el servidor");
      };
    },
    [fiscalYear],
  );

  // ── SSE for export ──
  const connectToExportJobSSE = useCallback((jobId: string, empId: string) => {
    exportEventSourceRef.current?.close();

    const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
    exportEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.step) setExportStep(data.step);

        if (data.done) {
          es.close();
          exportEventSourceRef.current = null;
          setExportingId(null);
          setExportStep(null);

          if (data.status === "COMPLETED") {
            setExportResults((prev) => {
              const next = new Map(prev);
              next.set(empId, { status: "success" });
              return next;
            });
            toast.success("Empleador exportado a SiRADIG");
          } else {
            setExportResults((prev) => {
              const next = new Map(prev);
              next.set(empId, {
                status: "failed",
                error: data.errorMessage || "Error al exportar",
              });
              return next;
            });
            toast.error("Error al exportar empleador");
          }
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      es.close();
      exportEventSourceRef.current = null;
      setExportingId(null);
      setExportStep(null);
      toast.error("Se perdió la conexión con el servidor");
    };
  }, []);

  // ── Active job recovery ──
  useEffect(() => {
    let cancelled = false;

    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_EMPLOYERS" &&
            j.fiscalYear === fiscalYear &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setImporting(true);
          if (activeJob.currentStep) setImportStep(activeJob.currentStep);
          connectToJobSSE(activeJob.id);
        }
      } catch {
        /* best-effort */
      }
    }

    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear, connectToJobSSE]);

  // ── CRUD handlers ──
  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(emp: Employer) {
    setEditing(emp);
    setDialogOpen(true);
  }

  function handleSaved(emp: Employer) {
    setEmployers((prev) => {
      const idx = prev.findIndex((e) => e.id === emp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = emp;
        return next;
      }
      return [...prev, emp];
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/empleadores/${deleteId}`, { method: "DELETE" });
      setEmployers((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Empleador eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  // ── Import handler ──
  async function handleImport() {
    setImporting(true);
    setImportStep(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_EMPLOYERS", fiscalYear }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar importación");
      }

      const { job } = await res.json();
      connectToJobSSE(job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar";
      toast.error(msg);
      setImporting(false);
    }
  }

  // ── Export handler ──
  const handleExport = useCallback(
    async (empId: string) => {
      setExportingId(empId);
      setExportStep(null);
      setExportResults((prev) => {
        const next = new Map(prev);
        next.delete(empId);
        return next;
      });

      try {
        const res = await fetch("/api/automatizacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType: "PUSH_EMPLOYERS",
            fiscalYear,
            employerId: empId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al iniciar exportación");
        }

        const { job } = await res.json();
        connectToExportJobSSE(job.id, empId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error al exportar";
        toast.error(errorMsg);
        setExportingId(null);
        setExportResults((prev) => {
          const next = new Map(prev);
          next.set(empId, { status: "failed", error: errorMsg });
          return next;
        });
      }
    },
    [fiscalYear, connectToExportJobSSE],
  );

  // ── Render ──
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openAdd}
          disabled={importing || isExporting || readOnly}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar empleador
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          disabled={importing || isExporting || readOnly || profileImporting}
        >
          {importing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Importar desde SiRADIG
        </Button>
      </div>

      {/* Import progress */}
      {importing && importStep && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          {getStepsForJobType("PULL_EMPLOYERS").find((s) => s.key === importStep)?.label ??
            importStep}
        </p>
      )}

      {/* Employer list */}
      {employers.length === 0 && !importing ? (
        <div className="text-muted-foreground/60 flex flex-col items-center gap-2 py-8 text-center text-sm">
          <Building2 className="h-8 w-8 opacity-40" />
          <p>No hay empleadores cargados para este periodo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employers.map((emp) => {
            const isExportingThis = exportingId === emp.id;
            const exportResult = exportResults.get(emp.id);
            const highlight = highlightedIds.get(emp.id);

            let cardClass =
              "border-border bg-card rounded-xl border p-4 transition-all duration-300";
            if (isExportingThis) {
              cardClass +=
                " border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 animate-pulse";
            } else if (exportResult?.status === "success") {
              cardClass +=
                " border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20";
            } else if (exportResult?.status === "failed") {
              cardClass +=
                " border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20";
            } else if (highlight === "created") {
              cardClass +=
                " border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20";
            } else if (highlight === "updated") {
              cardClass +=
                " border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20";
            }

            return (
              <div key={emp.id} className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{emp.razonSocial}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{formatCuit(emp.cuit)}</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span>Desde: {emp.fechaInicio}</span>
                      <span>Hasta: {emp.fechaFin || "Actual"}</span>
                      <span
                        className={
                          emp.agenteRetencion
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : ""
                        }
                      >
                        {emp.agenteRetencion ? "Agente de retención" : "No es agente de retención"}
                      </span>
                    </div>
                    {isExportingThis && exportStep && (
                      <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {getStepsForJobType("PUSH_EMPLOYERS").find((s) => s.key === exportStep)
                          ?.label ?? exportStep}
                      </p>
                    )}
                    {highlight && (
                      <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {highlight === "created" ? "nuevo" : "actualizado"}
                      </span>
                    )}
                    {exportResult?.status === "failed" && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {exportResult.error}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* Export */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleExport(emp.id)}
                      disabled={importing || isExporting || readOnly}
                      title="Desgravar"
                    >
                      {isExportingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : exportResult?.status === "success" ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      ) : exportResult?.status === "failed" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(emp)}
                      disabled={importing || isExporting || readOnly}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteId(emp.id)}
                      disabled={importing || isExporting || readOnly}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <EmployerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        fiscalYear={fiscalYear}
        onSaved={handleSaved}
        hasAgenteRetencion={employers.some((e) => e.agenteRetencion)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar empleador</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El empleador será eliminado de tu perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
