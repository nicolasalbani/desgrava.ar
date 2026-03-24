"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
  Search,
  Receipt,
  Download,
  Upload,
  Send,
  X,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useAttentionCounts } from "@/contexts/attention-counts";
import { formatCuit } from "@/lib/validators/cuit";
import { JobStatusBadge, type LatestJob } from "@/components/shared/job-status-badge";
import { JobHistoryPanel } from "@/components/shared/job-history-panel";
import { usePaginatedFetch } from "@/hooks/use-paginated-fetch";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface ReceiptRow {
  id: string;
  domesticWorkerId: string | null;
  fiscalYear: number;
  fiscalMonth: number;
  periodo: string;
  categoriaProfesional: string | null;
  total: string; // Decimal comes as string from API
  contributionAmount: string | null;
  source: string;
  siradiqStatus: string;
  originalFilename: string | null;
  fileMimeType: string | null;
  hasFile: boolean;
  createdAt: string;
  domesticWorker: {
    id: string;
    apellidoNombre: string;
    cuil: string;
  } | null;
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

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$ ${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptList({
  onInitialLoad,
  attentionFilter = false,
}: {
  onInitialLoad?: (count: number) => void;
  attentionFilter?: boolean;
}) {
  const { fiscalYear } = useFiscalYear();
  const { invalidate: invalidateAttention } = useAttentionCounts();

  // Local filter UI state
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [contribMin, setContribMin] = useState("");
  const [contribMax, setContribMax] = useState("");

  // Action state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  // Derive unique categories from current page data for filter options
  // With server-side pagination we only see the current page, so we show all known categories
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  // Paginated fetch
  const {
    data: receipts,
    setData: setReceipts,
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
  } = usePaginatedFetch<ReceiptRow>({
    url: "/api/recibos",
    dataKey: "receipts",
    staticParams: useMemo(
      () => ({
        fiscalYear: fiscalYear?.toString(),
        attentionFilter: attentionFilter ? "true" : undefined,
      }),
      [fiscalYear, attentionFilter],
    ),
    onInitialLoad,
  });

  // Build known categories from received data
  useEffect(() => {
    const cats = new Set(knownCategories);
    for (const r of receipts) {
      if (r.categoriaProfesional) cats.add(r.categoriaProfesional);
    }
    const sorted = Array.from(cats).sort();
    if (sorted.join(",") !== knownCategories.join(",")) {
      setKnownCategories(sorted);
    }
  }, [receipts, knownCategories]);

  // Sync local filter state to the hook
  useEffect(() => {
    setFilters({
      categories: categories.size > 0 ? Array.from(categories).join(",") : undefined,
      statuses: statuses.size > 0 ? Array.from(statuses).join(",") : undefined,
      totalMin: totalMin || undefined,
      totalMax: totalMax || undefined,
      contribMin: contribMin || undefined,
      contribMax: contribMax || undefined,
    });
  }, [categories, statuses, totalMin, totalMax, contribMin, contribMax, setFilters]);

  // Poll while any receipt has in-flight jobs
  useEffect(() => {
    const hasInFlight = receipts.some(
      (r) =>
        r.siradiqStatus === "QUEUED" ||
        r.siradiqStatus === "PROCESSING" ||
        r.latestJob?.status === "PENDING" ||
        r.latestJob?.status === "RUNNING",
    );
    setShouldPoll(hasInFlight);
  }, [receipts, setShouldPoll]);

  const availableStatuses = (meta.availableStatuses as string[]) ?? [];

  const isCategoryActive = categories.size > 0;
  const isTotalActive = totalMin !== "" || totalMax !== "";
  const isContribActive = contribMin !== "" || contribMax !== "";
  const isStatusActive = statuses.size > 0;

  const hasActiveFilters =
    search !== "" || isCategoryActive || isStatusActive || isTotalActive || isContribActive;

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/recibos/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReceipts((prev) => prev.filter((r) => r.id !== deleteId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      toast.success("Recibo eliminado");
      invalidateAttention();
      refetch();
    } catch {
      toast.error("Error al eliminar recibo");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function handleBulkDelete() {
    const deletableIds = Array.from(selectedIds);
    if (deletableIds.length === 0) return;

    setBulkDeleting(true);
    setBulkDeleteOpen(false);

    const results = await Promise.allSettled(
      deletableIds.map((id) => fetch(`/api/recibos/${id}`, { method: "DELETE" })),
    );

    const deleted = deletableIds.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.ok;
    });

    if (deleted.length > 0) {
      setReceipts((prev) => prev.filter((r) => !deleted.includes(r.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        deleted.length === 1 ? "Recibo eliminado" : `${deleted.length} recibos eliminados`,
      );
      invalidateAttention();
      refetch();
    }
    const failed = deletableIds.length - deleted.length;
    if (failed > 0) toast.error(`${failed} recibo(s) no se pudieron eliminar`);

    setBulkDeleting(false);
  }

  async function handleSubmitToSiradig() {
    if (selectedIds.size === 0) return;
    if (!fiscalYear) {
      toast.error("Selecciona un año fiscal antes de enviar a SiRADIG", { duration: 5000 });
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "SUBMIT_DOMESTIC_DEDUCTION",
          fiscalYear,
          receiptIds: Array.from(selectedIds),
        }),
      });

      if (res.ok) {
        const jobData = await res.json().catch(() => null);
        const latestJobData: LatestJob | null = jobData?.job
          ? {
              id: jobData.job.id,
              status: jobData.job.status,
              createdAt: jobData.job.createdAt,
              errorMessage: null,
            }
          : null;
        toast.success("Deduccion de servicio domestico enviada a la cola de SiRADIG");
        setReceipts((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id)
              ? { ...r, siradiqStatus: "QUEUED", latestJob: latestJobData ?? r.latestJob }
              : r,
          ),
        );
        setSelectedIds(new Set());
        invalidateAttention();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Error al enviar a SiRADIG");
      }
    } catch {
      toast.error("Error de conexion al enviar a SiRADIG");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendSingle(receiptId: string) {
    if (!fiscalYear) {
      toast.error("Selecciona un año fiscal antes de enviar a SiRADIG");
      return;
    }
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "SUBMIT_DOMESTIC_DEDUCTION",
          fiscalYear,
          receiptIds: [receiptId],
        }),
      });
      if (res.ok) {
        const jobData = await res.json().catch(() => null);
        const latestJobData: LatestJob | null = jobData?.job
          ? {
              id: jobData.job.id,
              status: jobData.job.status,
              createdAt: jobData.job.createdAt,
              errorMessage: null,
            }
          : null;
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receiptId
              ? { ...r, siradiqStatus: "QUEUED", latestJob: latestJobData ?? r.latestJob }
              : r,
          ),
        );
        toast.success("Recibo enviado a la cola de SiRADIG");
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

  const eligibleReceipts = receipts.filter(
    (r) => r.latestJob?.status !== "PENDING" && r.latestJob?.status !== "RUNNING",
  );
  const allEligibleSelected =
    eligibleReceipts.length > 0 && eligibleReceipts.every((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleReceipts.map((r) => r.id)));
    }
  }

  function clearAllFilters() {
    setSearch("");
    setCategories(new Set());
    setStatuses(new Set());
    setTotalMin("");
    setTotalMax("");
    setContribMin("");
    setContribMax("");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (receipts.length === 0 && !hasActiveFilters && pagination.totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
          <Receipt className="text-muted-foreground/50 h-5 w-5" />
        </div>
        <p className="text-muted-foreground/70 text-sm">No hay recibos cargados</p>
        <p className="text-muted-foreground/50 mt-1 text-xs">
          Importa desde ARCA o subi un archivo para empezar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground/40 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por trabajador o CUIL..."
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
        {pagination.totalCount > 0 && (
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {pagination.totalCount} {pagination.totalCount === 1 ? "recibo" : "recibos"}
          </span>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-muted/40 flex items-center gap-3 rounded-xl px-5 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <Button size="sm" onClick={handleSubmitToSiradig} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar a SiRADIG
          </Button>
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

      {/* Mobile card layout */}
      <div className="divide-border divide-y rounded-xl border md:hidden">
        {receipts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground/70 text-sm font-medium">Sin resultados</p>
            <p className="text-muted-foreground/50 mt-1 text-xs">
              Proba con otros filtros o terminos de busqueda
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-primary hover:text-primary/80 mt-3 text-xs transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          receipts.map((r) => {
            const isExpanded = expandedRowId === r.id;
            const isInFlight =
              r.latestJob?.status === "PENDING" || r.latestJob?.status === "RUNNING";
            const canCancel = isInFlight;
            return (
              <div key={r.id}>
                <div className="space-y-1.5 px-4 py-3">
                  {/* Row 1: Checkbox + Worker + Total */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleSelect(r.id)}
                      disabled={isInFlight}
                      title={isInFlight ? "Hay un envio en curso" : undefined}
                      aria-label={`Seleccionar recibo ${r.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      {r.domesticWorker ? (
                        <p className="truncate text-sm font-medium">
                          {r.domesticWorker.apellidoNombre}
                        </p>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin asignar</span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm">{formatAmount(r.total)}</span>
                  </div>
                  {/* Row 2: Category + Period */}
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-muted-foreground truncate text-xs">
                      {r.categoriaProfesional ?? "—"}
                    </span>
                    <span className="text-muted-foreground/40 text-xs">&middot;</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{r.periodo}</span>
                  </div>
                  {/* Row 3: Job status + Actions */}
                  <div className="flex items-center justify-between pl-6">
                    <button
                      onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                      className="inline-flex items-center gap-1"
                    >
                      <JobStatusBadge job={r.latestJob} />
                      {r.latestJob &&
                        (isExpanded ? (
                          <ChevronUp className="text-muted-foreground/40 h-3 w-3" />
                        ) : (
                          <ChevronDown className="text-muted-foreground/40 h-3 w-3" />
                        ))}
                    </button>
                    <div className="flex items-center gap-0.5">
                      {!isInFlight && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                          onClick={() => handleSendSingle(r.id)}
                          title="Enviar a SiRADIG"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                          onClick={() => handleCancelJob(r.latestJob!.id)}
                          disabled={cancellingJobId === r.latestJob!.id}
                          title="Cancelar envio"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {r.hasFile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                          onClick={() => window.open(`/api/recibos/${r.id}/file`, "_blank")}
                          title="Ver archivo"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-7 w-7"
                        onClick={() => setDeleteId(r.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-muted/20 border-border/50 border-t px-4 py-3">
                    <JobHistoryPanel
                      entityId={r.id}
                      entityType="receipt"
                      latestJobStatus={r.latestJob?.status}
                      onCancel={handleCancelJob}
                      cancelling={!!cancellingJobId}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table layout */}
      <div className="border-border hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allEligibleSelected && eligibleReceipts.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Seleccionar todos"
                  disabled={eligibleReceipts.length === 0}
                />
              </TableHead>
              <TableHead>Trabajador</TableHead>

              {/* Categoria — filter */}
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
                          {knownCategories.map((cat) => (
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
                              <span className="text-xs">{cat}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </TableHead>

              <TableHead>Periodo</TableHead>

              {/* Total — filter */}
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Total</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "rounded-md p-1 transition-colors",
                          isTotalActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <ListFilter className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-3" align="end">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs font-medium">Rango de total</p>
                        <div className="space-y-1.5">
                          <label className="text-muted-foreground/70 text-xs">Min $</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={totalMin}
                            onChange={(e) => setTotalMin(e.target.value.replace(/[^\d]/g, ""))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-muted-foreground/70 text-xs">Max $</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="999999"
                            value={totalMax}
                            onChange={(e) => setTotalMax(e.target.value.replace(/[^\d]/g, ""))}
                            className="h-8 text-xs"
                          />
                        </div>
                        {isTotalActive && (
                          <button
                            onClick={() => {
                              setTotalMin("");
                              setTotalMax("");
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

              {/* Contribucion — filter */}
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Contribucion</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "rounded-md p-1 transition-colors",
                          isContribActive
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
                          Rango de contribucion
                        </p>
                        <div className="space-y-1.5">
                          <label className="text-muted-foreground/70 text-xs">Min $</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={contribMin}
                            onChange={(e) => setContribMin(e.target.value.replace(/[^\d]/g, ""))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-muted-foreground/70 text-xs">Max $</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="999999"
                            value={contribMax}
                            onChange={(e) => setContribMax(e.target.value.replace(/[^\d]/g, ""))}
                            className="h-8 text-xs"
                          />
                        </div>
                        {isContribActive && (
                          <button
                            onClick={() => {
                              setContribMin("");
                              setContribMax("");
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

              {/* SiRADIG — filter */}
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
                                {key === NO_JOB ? "No enviado" : (JOB_STATUS_LABELS[key] ?? key)}
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
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <p className="text-muted-foreground/70 text-sm font-medium">Sin resultados</p>
                  <p className="text-muted-foreground/50 mt-1 text-xs">
                    Proba con otros filtros o terminos de busqueda
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-primary hover:text-primary/80 mt-3 text-xs transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => {
                const isExpanded = expandedRowId === r.id;
                const isInFlight =
                  r.latestJob?.status === "PENDING" || r.latestJob?.status === "RUNNING";
                const canCancel = isInFlight;
                return (
                  <React.Fragment key={r.id}>
                    <TableRow>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                          disabled={isInFlight}
                          title={isInFlight ? "Hay un envio en curso" : undefined}
                          aria-label={`Seleccionar recibo ${r.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.source === "ARCA" && (
                            <span title="Importado desde ARCA">
                              <Download className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                            </span>
                          )}
                          {(r.source === "PDF" || r.source === "OCR" || r.source === "MANUAL") && (
                            <span title="Cargado manualmente">
                              <Upload className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                            </span>
                          )}
                          {r.domesticWorker ? (
                            <div>
                              <p className="text-sm">{r.domesticWorker.apellidoNombre}</p>
                              <p className="text-muted-foreground text-xs">
                                {formatCuit(r.domesticWorker.cuil)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin asignar</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-xs">
                          {r.categoriaProfesional ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{r.periodo}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatAmount(r.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.contributionAmount ? formatAmount(r.contributionAmount) : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                          className="inline-flex items-center gap-1"
                        >
                          <JobStatusBadge job={r.latestJob} />
                          {r.latestJob &&
                            (isExpanded ? (
                              <ChevronUp className="text-muted-foreground/40 h-3 w-3" />
                            ) : (
                              <ChevronDown className="text-muted-foreground/40 h-3 w-3" />
                            ))}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isInFlight && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8"
                              onClick={() => handleSendSingle(r.id)}
                              title="Enviar a SiRADIG"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8"
                              onClick={() => handleCancelJob(r.latestJob!.id)}
                              disabled={cancellingJobId === r.latestJob!.id}
                              title="Cancelar envio"
                            >
                              <Square className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {r.hasFile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8"
                              onClick={() => window.open(`/api/recibos/${r.id}/file`, "_blank")}
                              title="Ver archivo"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8"
                            onClick={() => setDeleteId(r.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${r.id}-history`}>
                        <TableCell colSpan={9} className="bg-muted/20 px-6 py-3">
                          <JobHistoryPanel
                            entityId={r.id}
                            entityType="receipt"
                            latestJobStatus={r.latestJob?.status}
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

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar recibo</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara este recibo. Esta accion no se puede deshacer.
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

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {selectedIds.size} {selectedIds.size === 1 ? "recibo" : "recibos"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminaran permanentemente los recibos
              seleccionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
