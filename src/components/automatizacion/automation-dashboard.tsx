"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import { Bot, Loader2, Eye, Square, Trash2, Search, X, ListFilter } from "lucide-react";
import {
  DEDUCTION_CATEGORIES,
  DEDUCTION_CATEGORY_LABELS,
  INVOICE_TYPE_LABELS,
} from "@/lib/validators/invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JobDetail } from "./job-detail";

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
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  RUNNING: { label: "Ejecutando", variant: "outline" },
  COMPLETED: { label: "Completado", variant: "default" },
  FAILED: { label: "Error", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

const CANCELLABLE_STATUSES = ["PENDING", "RUNNING"];
const DELETABLE_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function AutomationDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/automatizacion");
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
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
      toast.success("Job eliminado");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Error al eliminar");
    }
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
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
  }, [jobs, categories, statuses, fechaDesde, fechaHasta, montoMin, montoMax, search]);

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

      {/* Content */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/70">
            No hay trabajos de automatizacion
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Selecciona facturas pendientes y envialas a SiRADIG desde la pagina
            de facturas.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
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

                <TableHead>Tipo</TableHead>
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

                <TableHead>CUIT</TableHead>

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
                  <TableCell colSpan={10} className="text-center py-12">
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
                      <TableCell className="text-sm">
                        {job.invoice?.providerName ?? job.invoice?.providerCuit ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice
                          ? (DEDUCTION_CATEGORY_LABELS[job.invoice.deductionCategory] ?? job.invoice.deductionCategory)
                          : job.jobType}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice
                          ? (INVOICE_TYPE_LABELS[job.invoice.invoiceType] ?? job.invoice.invoiceType)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice?.invoiceNumber ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice?.invoiceDate
                          ? new Date(job.invoice.invoiceDate).toLocaleDateString("es-AR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.invoice?.providerCuit ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium tabular-nums">
                        {job.invoice
                          ? `$${parseFloat(job.invoice.amount).toLocaleString("es-AR")}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                        {job.errorMessage && (
                          <p className="text-xs text-destructive mt-1 max-w-48 truncate" title={job.errorMessage}>
                            {job.errorMessage}
                          </p>
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
            <DialogTitle>Detalle del trabajo</DialogTitle>
            <DialogDescription>
              Logs y estado del job de automatizacion
            </DialogDescription>
          </DialogHeader>
          {selectedJob && <JobDetail jobId={selectedJob} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detener automatizacion</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelara el job de automatizacion. Si estaba en ejecucion, se detendra el proceso.
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar automatizacion</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el registro de este job permanentemente.
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
