"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Send, Loader2, Eye, Square, Trash2, Search, X, ListFilter, Mail, Upload, RotateCcw } from "lucide-react";
import {
  DEDUCTION_CATEGORIES,
  DEDUCTION_CATEGORY_LABELS,
} from "@/lib/validators/invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JobDetail } from "./job-detail";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface Job {
  id: string;
  jobType: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  invoice: {
    deductionCategory: string;
    providerCuit: string;
    providerName: string | null;
    invoiceType: string;
    amount: string;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    fiscalMonth: number;
    fiscalYear: number;
    source: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; animate?: boolean }> = {
  PENDING:   { label: "Pendiente",  dot: "bg-foreground/25" },
  RUNNING:   { label: "Ejecutando", dot: "bg-blue-400/70",    animate: true },
  COMPLETED: { label: "Completado", dot: "bg-emerald-400/80" },
  FAILED:    { label: "Error",      dot: "bg-rose-400/80" },
  CANCELLED: { label: "Cancelado",  dot: "bg-foreground/20" },
};

const CANCELLABLE_STATUSES = ["PENDING", "RUNNING"];
const DELETABLE_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function AutomationDashboard({
  onRegisterRefresh,
  onFirstJobCompleted,
  onJobDeleted,
}: {
  onRegisterRefresh?: (fn: () => void) => void;
  onFirstJobCompleted?: () => void;
  onJobDeleted?: () => void;
} = {}) {
  const { fiscalYear } = useFiscalYear();
  const hadCompletedJobOnLoad = useRef<boolean | null>(null);
  const celebrationFired = useRef(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    onRegisterRefresh?.(fetchJobs);
  }, [onRegisterRefresh]);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/automatizacion");
      const data = await res.json();
      const fetched: Job[] = data.jobs || [];
      const hasCompleted = fetched.some((j) => j.status === "COMPLETED");

      if (hadCompletedJobOnLoad.current === null) {
        hadCompletedJobOnLoad.current = hasCompleted;
      } else if (
        !hadCompletedJobOnLoad.current &&
        hasCompleted &&
        !celebrationFired.current
      ) {
        celebrationFired.current = true;
        onFirstJobCompleted?.();
      }

      setJobs(fetched);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(jobId: string) {
    const res = await fetch(`/api/automatizacion/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });

    if (res.ok) {
      toast.success("Job reintentado");
      fetchJobs();
    } else {
      toast.error("Error al reintentar");
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    const jobId = cancelTarget;
    setCancelTarget(null);

    const res = await fetch(`/api/automatizacion/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (res.ok) {
      toast.success("Job cancelado");
      fetchJobs();
    } else {
      toast.error("Error al cancelar");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const jobId = deleteTarget;
    setDeleteTarget(null);

    const res = await fetch(`/api/automatizacion/${jobId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
      toast.success("Job eliminado");
      onJobDeleted?.();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Error al eliminar");
    }
  }

  async function handleBulkDelete() {
    const deletableIds = jobs
      .filter((j) => selectedIds.has(j.id) && DELETABLE_STATUSES.includes(j.status))
      .map((j) => j.id);
    if (deletableIds.length === 0) return;

    setBulkDeleting(true);
    setBulkDeleteOpen(false);

    const results = await Promise.allSettled(
      deletableIds.map((id) => fetch(`/api/automatizacion/${id}`, { method: "DELETE" }))
    );

    const deleted = deletableIds.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.ok;
    });

    if (deleted.length > 0) {
      setJobs((prev) => prev.filter((j) => !deleted.includes(j.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(deleted.length === 1 ? "Job eliminado" : `${deleted.length} jobs eliminados`);
      onJobDeleted?.();
    }
    const failed = deletableIds.length - deleted.length;
    if (failed > 0) toast.error(`${failed} job(s) no se pudieron eliminar`);

    setBulkDeleting(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (fiscalYear !== null && job.invoice?.fiscalYear !== fiscalYear) return false;
      if (categories.size > 0) {
        const cat = job.invoice?.deductionCategory;
        if (!cat || !categories.has(cat)) return false;
      }
      if (statuses.size > 0 && !statuses.has(job.status)) return false;
      if (fechaDesde) {
        if (!job.invoice?.invoiceDate) return false;
        if (new Date(job.invoice.invoiceDate) < new Date(fechaDesde)) return false;
      }
      if (fechaHasta) {
        if (!job.invoice?.invoiceDate) return false;
        if (new Date(job.invoice.invoiceDate) > new Date(fechaHasta)) return false;
      }
      if (montoMin) {
        const min = parseInt(montoMin);
        if (!isNaN(min) && (!job.invoice || parseFloat(job.invoice.amount) < min)) return false;
      }
      if (montoMax) {
        const max = parseInt(montoMax);
        if (!isNaN(max) && (!job.invoice || parseFloat(job.invoice.amount) > max)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !job.invoice?.providerName?.toLowerCase().includes(q) &&
          !job.invoice?.providerCuit.includes(q) &&
          !job.invoice?.invoiceNumber?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [jobs, fiscalYear, categories, statuses, fechaDesde, fechaHasta, montoMin, montoMax, search]);

  const hasClientFilters =
    search !== "" ||
    categories.size > 0 ||
    statuses.size > 0 ||
    fechaDesde !== "" ||
    fechaHasta !== "" ||
    montoMin !== "" ||
    montoMax !== "";

  function clearAllFilters() {
    setSearch("");
    setCategories(new Set());
    setStatuses(new Set());
    setFechaDesde("");
    setFechaHasta("");
    setMontoMin("");
    setMontoMax("");
  }

  const isCategoryActive = categories.size > 0;
  const isStatusActive = statuses.size > 0;
  const isFechaActive = fechaDesde !== "" || fechaHasta !== "";
  const isMontoActive = montoMin !== "" || montoMax !== "";

  const selectableJobs = filteredJobs.filter((j) => DELETABLE_STATUSES.includes(j.status));
  const allSelectableSelected =
    selectableJobs.length > 0 && selectableJobs.every((j) => selectedIds.has(j.id));

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableJobs.map((j) => j.id)));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <Input
            placeholder="Buscar por proveedor, CUIT o comprobante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {jobs.length > 0 && (
          <span className="text-sm text-muted-foreground tabular-nums shrink-0">
            {hasClientFilters
              ? `${filteredJobs.length} de ${jobs.length}`
              : jobs.length}{" "}
            {jobs.length === 1 && !hasClientFilters ? "trabajo" : "trabajos"}
          </span>
        )}
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-5 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Eliminar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkDeleting}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Content */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Send className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/70">
            Sin envios a SiRADIG
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Selecciona facturas pendientes y envialas a SiRADIG desde la pagina
            de facturas.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelectableSelected && selectableJobs.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                    disabled={selectableJobs.length === 0}
                  />
                </TableHead>
                <TableHead>Proveedor</TableHead>

                {/* Categoria filter */}
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Categoria</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "rounded-md p-1 transition-colors",
                            isCategoryActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-3" align="start">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              Filtrar por categoria
                            </p>
                            {isCategoryActive && (
                              <button
                                onClick={() => setCategories(new Set())}
                                className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {DEDUCTION_CATEGORIES.map((cat) => (
                              <label
                                key={cat}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <Checkbox
                                  checked={categories.has(cat)}
                                  onCheckedChange={(checked) => {
                                    setCategories((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(cat);
                                      else next.delete(cat);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-xs">
                                  {DEDUCTION_CATEGORY_LABELS[cat]}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                <TableHead>Nro. Comprobante</TableHead>

                {/* Fecha filter */}
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Fecha</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "rounded-md p-1 transition-colors",
                            isFechaActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3" align="start">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Rango de fecha
                          </p>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground/70">
                              Desde
                            </label>
                            <Input
                              type="date"
                              value={fechaDesde}
                              onChange={(e) => setFechaDesde(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground/70">
                              Hasta
                            </label>
                            <Input
                              type="date"
                              value={fechaHasta}
                              onChange={(e) => setFechaHasta(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          {isFechaActive && (
                            <button
                              onClick={() => {
                                setFechaDesde("");
                                setFechaHasta("");
                              }}
                              className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Monto filter */}
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>Monto</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "rounded-md p-1 transition-colors",
                            isMontoActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-3" align="end">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Rango de monto
                          </p>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground/70">
                              Min $
                            </label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={montoMin}
                              onChange={(e) =>
                                setMontoMin(e.target.value.replace(/[^\d]/g, ""))
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground/70">
                              Max $
                            </label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="999999"
                              value={montoMax}
                              onChange={(e) =>
                                setMontoMax(e.target.value.replace(/[^\d]/g, ""))
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          {isMontoActive && (
                            <button
                              onClick={() => {
                                setMontoMin("");
                                setMontoMax("");
                              }}
                              className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Estado filter */}
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Estado</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "rounded-md p-1 transition-colors",
                            isStatusActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-3" align="start">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              Filtrar por estado
                            </p>
                            {isStatusActive && (
                              <button
                                onClick={() => setStatuses(new Set())}
                                className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <Checkbox
                                  checked={statuses.has(key)}
                                  onCheckedChange={(checked) => {
                                    setStatuses((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(key);
                                      else next.delete(key);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-xs">{cfg.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <p className="text-sm font-medium text-muted-foreground/70">
                      Sin resultados
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      Proba con otros filtros o terminos de busqueda
                    </p>
                    <button
                      onClick={clearAllFilters}
                      className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => {
                  const statusConfig = STATUS_CONFIG[job.status] ?? {
                    label: job.status,
                    variant: "secondary" as const,
                  };
                  const isCancellable = CANCELLABLE_STATUSES.includes(job.status);
                  const isDeletable = DELETABLE_STATUSES.includes(job.status);
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.has(job.id)}
                          onCheckedChange={() => toggleSelect(job.id)}
                          disabled={!isDeletable}
                          aria-label={`Seleccionar job ${job.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          {job.invoice?.source === "EMAIL" && (
                            <span title="Cargada por email">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                            </span>
                          )}
                          {(job.invoice?.source === "PDF" || job.invoice?.source === "OCR") && (
                            <span title="Cargada por archivo">
                              <Upload className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                            </span>
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {job.invoice?.providerName ?? job.invoice?.providerCuit ?? "-"}
                            </p>
                            {job.invoice?.providerName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {job.invoice.providerCuit}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span
                          className="block truncate text-sm text-muted-foreground"
                          title={job.invoice ? (DEDUCTION_CATEGORY_LABELS[job.invoice.deductionCategory] ?? job.invoice.deductionCategory) : job.jobType}
                        >
                          {job.invoice
                            ? (DEDUCTION_CATEGORY_LABELS[job.invoice.deductionCategory] ?? job.invoice.deductionCategory)
                            : job.jobType}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice?.invoiceNumber ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice?.invoiceDate
                          ? new Date(job.invoice.invoiceDate).toLocaleDateString("es-AR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium tabular-nums">
                        {job.invoice
                          ? `$${parseFloat(job.invoice.amount).toLocaleString("es-AR")}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {job.status === "FAILED" && job.errorMessage ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1.5 cursor-default">
                                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusConfig.dot)} />
                                  <span className="text-xs font-medium text-foreground/70">{statusConfig.label}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-72">
                                {job.errorMessage}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusConfig.dot, statusConfig.animate && "animate-pulse")} />
                            <span className="text-xs font-medium text-foreground/70">{statusConfig.label}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedJob(job.id)}
                            title="Ver detalle"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isCancellable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCancelTarget(job.id)}
                              title="Detener"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                          {job.status === "FAILED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetry(job.id)}
                              title="Reintentar"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {isDeletable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(job.id)}
                              title="Eliminar"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del envio</DialogTitle>
            <DialogDescription>
              Logs y estado del envio a SiRADIG
            </DialogDescription>
          </DialogHeader>
          {selectedJob && <JobDetail jobId={selectedJob} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detener envio</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelara el envio a SiRADIG. Si estaba en ejecucion, se detendra el proceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              Detener
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "envio" : "envios"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminaran permanentemente los
              envios seleccionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el registro de este envio permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
