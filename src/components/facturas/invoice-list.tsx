"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Loader2,
  Trash2,
  Send,
  FileDown,
  FileText,
  Search,
  X,
  ListFilter,
  Pencil,
  Mail,
  Upload,
  Download,
  Tags,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceForm } from "./invoice-form";
import { formatCuit } from "@/lib/validators/cuit";
import { DEDUCTION_CATEGORIES, DEDUCTION_CATEGORY_LABELS } from "@/lib/validators/invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useAttentionCounts } from "@/contexts/attention-counts";
import { JobStatusBadge, type LatestJob } from "@/components/shared/job-status-badge";
import { JobHistoryPanel } from "@/components/shared/job-history-panel";
import { usePaginatedFetch } from "@/hooks/use-paginated-fetch";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface FamilyDependentRef {
  id: string;
  nombre: string;
  apellido: string;
}

interface Invoice {
  id: string;
  deductionCategory: string;
  providerCuit: string;
  providerName: string | null;
  invoiceType: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: string;
  fiscalYear: number;
  fiscalMonth: number;
  source: string;
  siradiqStatus: string;
  hasFile: boolean;
  createdAt: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  familyDependentId: string | null;
  familyDependent: FamilyDependentRef | null;
  latestJob: LatestJob | null;
}

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  RUNNING: "Ejecutando",
  COMPLETED: "Completado",
  FAILED: "Error",
  CANCELLED: "Cancelado",
};

const NO_JOB = "__NO_JOB__";

function isFutureMonth(inv: Invoice): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (
    inv.fiscalYear > currentYear ||
    (inv.fiscalYear === currentYear && inv.fiscalMonth > currentMonth)
  );
}

export function InvoiceList({
  onInitialLoad,
  attentionFilter = false,
}: {
  onInitialLoad?: (count: number) => void;
  attentionFilter?: boolean;
} = {}) {
  const { fiscalYear } = useFiscalYear();
  const { invalidate: invalidateAttention } = useAttentionCounts();

  // Local filter UI state
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");

  // Action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkCategoryUpdating, setBulkCategoryUpdating] = useState(false);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [dependents, setDependents] = useState<FamilyDependentRef[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const celebratedRef = useRef(
    typeof window !== "undefined" && localStorage.getItem("siradig-celebrated") === "true",
  );

  // Paginated fetch
  const {
    data: invoices,
    setData: setInvoices,
    pagination,
    loading,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch,
    setFilters,
    setShouldPoll,
    meta,
  } = usePaginatedFetch<Invoice>({
    url: "/api/facturas",
    dataKey: "invoices",
    staticParams: useMemo(
      () => ({
        fiscalYear: fiscalYear?.toString(),
        attentionFilter: attentionFilter ? "true" : undefined,
      }),
      [fiscalYear, attentionFilter],
    ),
    onInitialLoad,
  });

  // Sync local filter state to the hook (batched in a single setFilters call)
  useEffect(() => {
    setFilters({
      categories: categories.size > 0 ? Array.from(categories).join(",") : undefined,
      statuses: statuses.size > 0 ? Array.from(statuses).join(",") : undefined,
      dateFrom: fechaDesde || undefined,
      dateTo: fechaHasta || undefined,
      amountMin: montoMin || undefined,
      amountMax: montoMax || undefined,
    });
  }, [categories, statuses, fechaDesde, fechaHasta, montoMin, montoMax, setFilters]);

  // Fetch dependents for education invoices
  useEffect(() => {
    if (fiscalYear !== null) {
      fetch(`/api/cargas-familia?year=${fiscalYear}`)
        .then((res) => res.json())
        .then((data) => setDependents(data.dependents || []))
        .catch(() => setDependents([]));
    }
  }, [fiscalYear]);

  // Poll while any invoice has in-flight jobs
  useEffect(() => {
    const hasInFlight = invoices.some(
      (inv) =>
        inv.siradiqStatus === "QUEUED" ||
        inv.siradiqStatus === "PROCESSING" ||
        inv.latestJob?.status === "PENDING" ||
        inv.latestJob?.status === "RUNNING",
    );
    setShouldPoll(hasInFlight);
  }, [invoices, setShouldPoll]);

  // Celebrate the first successful SiRADIG submission
  useEffect(() => {
    if (celebratedRef.current) return;
    const hasCompleted = invoices.some((inv) => inv.latestJob?.status === "COMPLETED");
    if (hasCompleted) {
      celebratedRef.current = true;
      localStorage.setItem("siradig-celebrated", "true");
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ffffff"],
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#6366f1", "#8b5cf6", "#a78bfa"],
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#6366f1", "#8b5cf6", "#a78bfa"],
        });
      }, 200);
      toast.success("Tu primera deduccion fue enviada a SiRADIG", {
        duration: 6000,
      });
    }
  }, [invoices]);

  async function handleLinkDependent(invoiceId: string, dependentId: string | null) {
    const res = await fetch(`/api/facturas/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyDependentId: dependentId }),
    });
    if (res.ok) {
      const linked = dependentId ? (dependents.find((d) => d.id === dependentId) ?? null) : null;
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? { ...inv, familyDependentId: dependentId, familyDependent: linked }
            : inv,
        ),
      );
      toast.success(dependentId ? "Familiar vinculado" : "Vinculacion removida");
      invalidateAttention();
    } else {
      toast.error("Error al vincular familiar");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);

    const res = await fetch(`/api/facturas/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Factura eliminada");
      invalidateAttention();
      refetch();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Error al eliminar");
    }
  }

  async function handleBulkDelete() {
    const deletableIds = Array.from(selectedIds);
    if (deletableIds.length === 0) return;

    setBulkDeleting(true);
    setBulkDeleteOpen(false);

    const results = await Promise.allSettled(
      deletableIds.map((id) => fetch(`/api/facturas/${id}`, { method: "DELETE" })),
    );

    const deleted = deletableIds.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.ok;
    });

    if (deleted.length > 0) {
      setInvoices((prev) => prev.filter((inv) => !deleted.includes(inv.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        deleted.length === 1 ? "Factura eliminada" : `${deleted.length} facturas eliminadas`,
      );
      invalidateAttention();
      refetch();
    }
    const failed = deletableIds.length - deleted.length;
    if (failed > 0) toast.error(`${failed} factura(s) no se pudieron eliminar`);

    setBulkDeleting(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const eligibleInvoices = invoices.filter(
    (inv) =>
      !isFutureMonth(inv) &&
      inv.latestJob?.status !== "PENDING" &&
      inv.latestJob?.status !== "RUNNING",
  );
  const allEligibleSelected =
    eligibleInvoices.length > 0 && eligibleInvoices.every((inv) => selectedIds.has(inv.id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleInvoices.map((inv) => inv.id)));
    }
  }

  async function handleBulkCategoryChange() {
    if (!bulkCategory || selectedIds.size === 0) return;
    setBulkCategoryUpdating(true);
    try {
      const res = await fetch("/api/facturas/bulk-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedIds),
          deductionCategory: bulkCategory,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Error al actualizar categorías");
        return;
      }
      const { updated } = await res.json();
      const label =
        DEDUCTION_CATEGORY_LABELS[bulkCategory as keyof typeof DEDUCTION_CATEGORY_LABELS] ??
        bulkCategory;
      toast.success(
        `${updated} comprobante${updated === 1 ? "" : "s"} actualizado${updated === 1 ? "" : "s"} a ${label}`,
      );

      setInvoices((prev) =>
        prev.map((inv) =>
          selectedIds.has(inv.id) ? { ...inv, deductionCategory: bulkCategory } : inv,
        ),
      );
      setSelectedIds(new Set());
      setBulkCategoryOpen(false);
      setBulkCategory("");
      invalidateAttention();
    } catch {
      toast.error("Error de conexión al actualizar categorías");
    } finally {
      setBulkCategoryUpdating(false);
    }
  }

  async function handleSubmitToSiradig() {
    if (selectedIds.size === 0) return;
    if (fiscalYear === null) {
      toast.error("Seleccioná un año fiscal antes de enviar facturas a SiRADIG", {
        duration: 5000,
      });
      return;
    }
    setSubmitting(true);

    let successCount = 0;
    let failCount = 0;
    const failedIds = new Set<string>();

    for (const invoiceId of selectedIds) {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv && inv.fiscalYear !== fiscalYear) {
        toast.error(
          `"${inv.providerName || inv.providerCuit}" es del año ${inv.fiscalYear}, pero el año fiscal activo es ${fiscalYear}. Cambiá el año o deseleccioná la factura.`,
          { duration: 6000 },
        );
        failedIds.add(invoiceId);
        failCount++;
        continue;
      }
      if (inv && inv.deductionCategory === "GASTOS_EDUCATIVOS" && !inv.familyDependentId) {
        toast.error(
          `"${inv.providerName || "Factura"}" es un gasto educativo sin familiar vinculado. Vinculá un familiar antes de enviar.`,
          { duration: 6000 },
        );
        failedIds.add(invoiceId);
        failCount++;
        continue;
      }
      try {
        const res = await fetch("/api/automatizacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId, jobType: "SUBMIT_INVOICE" }),
        });
        if (res.ok) {
          const jobData = await res.json().catch(() => null);
          successCount++;
          setInvoices((prev) =>
            prev.map((inv) =>
              inv.id === invoiceId
                ? {
                    ...inv,
                    siradiqStatus: "QUEUED",
                    latestJob: jobData?.job
                      ? {
                          id: jobData.job.id,
                          status: jobData.job.status,
                          createdAt: jobData.job.createdAt,
                          errorMessage: null,
                        }
                      : inv.latestJob,
                  }
                : inv,
            ),
          );
        } else {
          failCount++;
          failedIds.add(invoiceId);
        }
      } catch {
        failCount++;
        failedIds.add(invoiceId);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} factura(s) enviada(s) a la cola de SiRADIG`);
      invalidateAttention();
    }
    if (failCount > 0) {
      toast.error(`${failCount} factura(s) no se pudieron enviar`);
    }

    setSelectedIds(failedIds);
    setSubmitting(false);
  }

  async function handleSendSingle(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    if (fiscalYear === null) {
      toast.error("Selecciona un año fiscal antes de enviar a SiRADIG");
      return;
    }
    if (inv.fiscalYear !== fiscalYear) {
      toast.error(
        `"${inv.providerName || inv.providerCuit}" es del año ${inv.fiscalYear}, pero el año fiscal activo es ${fiscalYear}.`,
      );
      return;
    }
    if (inv.deductionCategory === "GASTOS_EDUCATIVOS" && !inv.familyDependentId) {
      toast.error("Vincula un familiar antes de enviar gastos educativos a SiRADIG");
      return;
    }
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, jobType: "SUBMIT_INVOICE" }),
      });
      if (res.ok) {
        const jobData = await res.json().catch(() => null);
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === invoiceId
              ? {
                  ...i,
                  siradiqStatus: "QUEUED",
                  latestJob: jobData?.job
                    ? {
                        id: jobData.job.id,
                        status: jobData.job.status,
                        createdAt: jobData.job.createdAt,
                        errorMessage: null,
                      }
                    : i.latestJob,
                }
              : i,
          ),
        );
        toast.success("Factura enviada a la cola de SiRADIG");
        invalidateAttention();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Error al enviar a SiRADIG");
      }
    } catch {
      toast.error("Error de conexion al enviar a SiRADIG");
    }
  }

  async function handleCancelJob(jobId: string) {
    setCancellingJobId(jobId);
    try {
      const res = await fetch(`/api/automatizacion/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        toast.success("Job cancelado");
        refetch();
      } else {
        toast.error("Error al cancelar");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setCancellingJobId(null);
    }
  }

  // Available job statuses from the API (only statuses that exist in data)
  const availableStatuses = (meta.availableStatuses as string[]) ?? [];

  // --- Filter active helpers ---
  const isCategoryActive = categories.size > 0;
  const isFechaActive = fechaDesde !== "" || fechaHasta !== "";
  const isMontoActive = montoMin !== "" || montoMax !== "";
  const isStatusActive = statuses.size > 0;

  const hasActiveFilters =
    search !== "" || isCategoryActive || isStatusActive || isFechaActive || isMontoActive;

  function clearAllFilters() {
    setSearch("");
    setCategories(new Set());
    setStatuses(new Set());
    setFechaDesde("");
    setFechaHasta("");
    setMontoMin("");
    setMontoMax("");
  }

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground/40 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por proveedor, CUIT o comprobante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground/40 hover:text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!loading && pagination.totalCount > 0 && (
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {pagination.totalCount} {pagination.totalCount === 1 ? "comprobante" : "comprobantes"}
          </span>
        )}
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/40 flex items-center gap-3 rounded-xl px-5 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <Button size="sm" onClick={handleSubmitToSiradig} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar a SiRADIG
          </Button>
          <Popover open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" disabled={submitting || bulkDeleting}>
                <Tags className="mr-2 h-4 w-4" />
                Cambiar categoría
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3">
              <p className="text-sm font-medium">Nueva categoría</p>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {DEDUCTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {DEDUCTION_CATEGORY_LABELS[cat as keyof typeof DEDUCTION_CATEGORY_LABELS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                disabled={!bulkCategory || bulkCategoryUpdating}
                onClick={handleBulkCategoryChange}
              >
                {bulkCategoryUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aplicar a {selectedIds.size} comprobante{selectedIds.size === 1 ? "" : "s"}
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={submitting || bulkDeleting}
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
            disabled={submitting || bulkDeleting}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
        </div>
      ) : invoices.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted/40 mb-4 rounded-full p-4">
            <FileText className="text-muted-foreground/30 h-6 w-6" />
          </div>
          <p className="text-muted-foreground/70 text-sm font-medium">Sin comprobantes</p>
          <p className="text-muted-foreground/50 mt-1.5 max-w-xs text-xs">
            {fiscalYear !== null
              ? `No hay facturas cargadas para ${fiscalYear}`
              : "No hay facturas cargadas"}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={allEligibleSelected && eligibleInvoices.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas"
                      disabled={eligibleInvoices.length === 0}
                    />
                  </TableHead>
                  <TableHead>Proveedor</TableHead>

                  {/* Categoria — funnel */}
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
                                : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-3" align="start">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-muted-foreground text-xs font-medium">
                                Filtrar por categoria
                              </p>
                              {isCategoryActive && (
                                <button
                                  onClick={() => setCategories(new Set())}
                                  className="text-muted-foreground/60 hover:text-foreground text-xs transition-colors"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                              {DEDUCTION_CATEGORIES.map((cat) => (
                                <label
                                  key={cat}
                                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
                                >
                                  <Checkbox
                                    checked={categories.has(cat)}
                                    onCheckedChange={(checked) => {
                                      setCategories((prev) => {
                                        const next = new Set(prev);
                                        if (checked) {
                                          next.add(cat);
                                        } else {
                                          next.delete(cat);
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className="text-xs">{DEDUCTION_CATEGORY_LABELS[cat]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>

                  <TableHead>Nro. Comprobante</TableHead>

                  {/* Fecha — funnel */}
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
                                : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-3" align="start">
                          <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-medium">
                              Rango de fecha
                            </p>
                            <div className="space-y-1.5">
                              <label className="text-muted-foreground/70 text-xs">Desde</label>
                              <Input
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-muted-foreground/70 text-xs">Hasta</label>
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
                                className="text-muted-foreground/60 hover:text-foreground text-xs transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>

                  {/* Monto — funnel */}
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
                                : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-3" align="end">
                          <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-medium">
                              Rango de monto
                            </p>
                            <div className="space-y-1.5">
                              <label className="text-muted-foreground/70 text-xs">Min $</label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={montoMin}
                                onChange={(e) => setMontoMin(e.target.value.replace(/[^\d]/g, ""))}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-muted-foreground/70 text-xs">Max $</label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="999999"
                                value={montoMax}
                                onChange={(e) => setMontoMax(e.target.value.replace(/[^\d]/g, ""))}
                                className="h-8 text-xs"
                              />
                            </div>
                            {isMontoActive && (
                              <button
                                onClick={() => {
                                  setMontoMin("");
                                  setMontoMax("");
                                }}
                                className="text-muted-foreground/60 hover:text-foreground text-xs transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>

                  {/* SiRADIG — funnel */}
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <span>SiRADIG</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "rounded-md p-1 transition-colors",
                              isStatusActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-3" align="start">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-muted-foreground text-xs font-medium">
                                Filtrar por estado
                              </p>
                              {isStatusActive && (
                                <button
                                  onClick={() => setStatuses(new Set())}
                                  className="text-muted-foreground/60 hover:text-foreground text-xs transition-colors"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div className="space-y-1">
                              {availableStatuses.map((key: string) => (
                                <label
                                  key={key}
                                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
                                >
                                  <Checkbox
                                    checked={statuses.has(key)}
                                    onCheckedChange={(checked) => {
                                      setStatuses((prev) => {
                                        const next = new Set(prev);
                                        if (checked) {
                                          next.add(key);
                                        } else {
                                          next.delete(key);
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className="text-xs">
                                    {key === NO_JOB
                                      ? "No enviado"
                                      : (JOB_STATUS_LABELS[key] ?? key)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <p className="text-muted-foreground/70 text-sm font-medium">Sin resultados</p>
                      <p className="text-muted-foreground/50 mt-1 text-xs">
                        Proba con otros filtros o terminos de busqueda
                      </p>
                      <button
                        onClick={clearAllFilters}
                        className="text-primary hover:text-primary/80 mt-3 text-xs transition-colors"
                      >
                        Limpiar filtros
                      </button>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => {
                    const isFuture = isFutureMonth(inv);
                    const isExpanded = expandedRowId === inv.id;
                    const isInFlight =
                      inv.latestJob?.status === "PENDING" || inv.latestJob?.status === "RUNNING";
                    const canCancel = isInFlight;
                    return (
                      <React.Fragment key={inv.id}>
                        <TableRow className="group">
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={selectedIds.has(inv.id)}
                              onCheckedChange={() => toggleSelect(inv.id)}
                              disabled={isFuture || isInFlight}
                              title={
                                isFuture
                                  ? "No disponible: el periodo fiscal aun no esta habilitado en SiRADIG"
                                  : isInFlight
                                    ? "Hay un envio en curso"
                                    : undefined
                              }
                              aria-label={`Seleccionar factura ${inv.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {inv.source === "EMAIL" && (
                                <span title="Cargada por email">
                                  <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                                </span>
                              )}
                              {(inv.source === "PDF" || inv.source === "OCR") && (
                                <span title="Cargada por archivo">
                                  <Upload className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                                </span>
                              )}
                              {inv.source === "ARCA" && (
                                <span title="Importada desde ARCA">
                                  <Download className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                                </span>
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {inv.providerName || inv.providerCuit}
                                </p>
                                {inv.providerName && (
                                  <p className="text-muted-foreground mt-0.5 text-xs">
                                    {inv.providerCuit}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span
                              className="text-muted-foreground block truncate text-sm"
                              title={
                                DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ??
                                inv.deductionCategory
                              }
                            >
                              {DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ??
                                inv.deductionCategory}
                            </span>
                            {inv.deductionCategory === "GASTOS_EDUCATIVOS" && (
                              <select
                                className="text-muted-foreground mt-0.5 max-w-full truncate border-none bg-transparent p-0 text-xs outline-none"
                                value={inv.familyDependentId ?? ""}
                                onChange={(e) =>
                                  handleLinkDependent(inv.id, e.target.value || null)
                                }
                              >
                                <option value="">Sin vincular</option>
                                {dependents.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.apellido} {d.nombre}
                                  </option>
                                ))}
                              </select>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {inv.invoiceNumber ?? "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {inv.invoiceDate
                              ? new Date(inv.invoiceDate).toLocaleDateString("es-AR")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">
                            ${parseFloat(inv.amount).toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setExpandedRowId(isExpanded ? null : inv.id)}
                              className="inline-flex items-center gap-1"
                            >
                              <JobStatusBadge job={inv.latestJob} />
                              {inv.latestJob &&
                                (isExpanded ? (
                                  <ChevronUp className="text-muted-foreground/40 h-3 w-3" />
                                ) : (
                                  <ChevronDown className="text-muted-foreground/40 h-3 w-3" />
                                ))}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {!isFuture && !isInFlight && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSendSingle(inv.id)}
                                  title="Enviar a SiRADIG"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {canCancel && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelJob(inv.latestJob!.id)}
                                  disabled={cancellingJobId === inv.latestJob!.id}
                                  title="Cancelar envio"
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditTarget(inv)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {inv.hasFile && (
                                <Button variant="ghost" size="icon" asChild title="Ver comprobante">
                                  <a
                                    href={`/api/facturas/${inv.id}/file`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(inv.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${inv.id}-history`}>
                            <TableCell colSpan={8} className="bg-muted/20 px-6 py-3">
                              <JobHistoryPanel
                                entityId={inv.id}
                                entityType="invoice"
                                latestJobStatus={inv.latestJob?.status}
                                onCancel={handleCancelJob}
                                cancelling={!!cancellingJobId}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la factura permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {selectedIds.size} {selectedIds.size === 1 ? "factura" : "facturas"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminaran permanentemente las facturas
              seleccionadas y sus envios a SiRADIG asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl [grid-template-rows:auto_1fr] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Editar comprobante</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            {editTarget && (
              <InvoiceForm
                invoiceId={editTarget.id}
                defaultValues={{
                  deductionCategory: editTarget.deductionCategory,
                  providerCuit: formatCuit(editTarget.providerCuit),
                  providerName: editTarget.providerName ?? undefined,
                  invoiceType: editTarget.invoiceType,
                  invoiceNumber: editTarget.invoiceNumber ?? undefined,
                  invoiceDate: editTarget.invoiceDate
                    ? editTarget.invoiceDate.slice(0, 10)
                    : undefined,
                  amount: parseFloat(editTarget.amount),
                  fiscalYear: editTarget.fiscalYear,
                  fiscalMonth: editTarget.fiscalMonth,
                  contractStartDate: editTarget.contractStartDate
                    ? editTarget.contractStartDate.slice(0, 10)
                    : undefined,
                  contractEndDate: editTarget.contractEndDate
                    ? editTarget.contractEndDate.slice(0, 10)
                    : undefined,
                  familyDependentId: editTarget.familyDependentId ?? undefined,
                }}
                onSaved={() => {
                  setEditTarget(null);
                  refetch();
                }}
                onCancel={() => setEditTarget(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
