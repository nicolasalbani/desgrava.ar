"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { formatCuit } from "@/lib/validators/cuit";

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
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  SUBMITTED: "Enviado",
  FAILED: "Error",
};

const SELECTABLE_STATUSES = ["PENDING", "FAILED"];

function statusDot(status: string) {
  const color =
    status === "SUBMITTED"
      ? "bg-green-500"
      : status === "FAILED"
        ? "bg-red-500"
        : status === "PROCESSING" || status === "QUEUED"
          ? "bg-blue-500 animate-pulse"
          : "bg-gray-400 dark:bg-gray-600";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$ ${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptList({ onInitialLoad }: { onInitialLoad?: (count: number) => void }) {
  const { fiscalYear } = useFiscalYear();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [contribMin, setContribMin] = useState("");
  const [contribMax, setContribMax] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchReceipts = useCallback(
    (showLoading = true) => {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams();
      if (fiscalYear) params.set("fiscalYear", String(fiscalYear));

      fetch(`/api/recibos?${params}`)
        .then((r) => r.json())
        .then((d) => {
          const list = d.receipts ?? [];
          setReceipts(list);
          onInitialLoad?.(list.length);
        })
        .catch(() => toast.error("Error al cargar recibos"))
        .finally(() => setLoading(false));
    },
    [fiscalYear, onInitialLoad],
  );

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Poll for status updates while any receipt is QUEUED or PROCESSING
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasInFlight = receipts.some(
      (r) => r.siradiqStatus === "QUEUED" || r.siradiqStatus === "PROCESSING",
    );
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(() => fetchReceipts(false), 5_000);
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [receipts, fetchReceipts]);

  // Derive unique categories from data
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of receipts) {
      if (r.categoriaProfesional) cats.add(r.categoriaProfesional);
    }
    return Array.from(cats).sort();
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      if (
        categories.size > 0 &&
        (!r.categoriaProfesional || !categories.has(r.categoriaProfesional))
      )
        return false;
      if (statuses.size > 0 && !statuses.has(r.siradiqStatus)) return false;
      if (totalMin) {
        const min = parseInt(totalMin);
        if (!isNaN(min) && parseFloat(r.total) < min) return false;
      }
      if (totalMax) {
        const max = parseInt(totalMax);
        if (!isNaN(max) && parseFloat(r.total) > max) return false;
      }
      if (contribMin) {
        const min = parseInt(contribMin);
        if (!isNaN(min) && (!r.contributionAmount || parseFloat(r.contributionAmount) < min))
          return false;
      }
      if (contribMax) {
        const max = parseInt(contribMax);
        if (!isNaN(max) && (!r.contributionAmount || parseFloat(r.contributionAmount) > max))
          return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.periodo.toLowerCase().includes(q) &&
          !r.domesticWorker?.apellidoNombre.toLowerCase().includes(q) &&
          !r.domesticWorker?.cuil.includes(q) &&
          !r.categoriaProfesional?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [receipts, categories, statuses, totalMin, totalMax, contribMin, contribMax, search]);

  const hasClientFilters =
    search !== "" ||
    categories.size > 0 ||
    statuses.size > 0 ||
    totalMin !== "" ||
    totalMax !== "" ||
    contribMin !== "" ||
    contribMax !== "";

  const isCategoryActive = categories.size > 0;
  const isTotalActive = totalMin !== "" || totalMax !== "";
  const isContribActive = contribMin !== "" || contribMax !== "";
  const isStatusActive = statuses.size > 0;

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
        toast.success("Deduccion de servicio domestico enviada a la cola de SiRADIG");
        setReceipts((prev) =>
          prev.map((r) => (selectedIds.has(r.id) ? { ...r, siradiqStatus: "QUEUED" } : r)),
        );
        setSelectedIds(new Set());
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

  const eligibleReceipts = filtered.filter((r) => SELECTABLE_STATUSES.includes(r.siradiqStatus));
  const allEligibleSelected =
    eligibleReceipts.length > 0 && eligibleReceipts.every((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleReceipts.map((r) => r.id)));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (receipts.length === 0) {
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
        {receipts.length > 0 && (
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {hasClientFilters ? `${filtered.length} de ${receipts.length}` : receipts.length}{" "}
            {receipts.length === 1 && !hasClientFilters ? "recibo" : "recibos"}
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

      <div className="border-border rounded-xl border">
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
                          {uniqueCategories.map((cat) => (
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

              {/* Estado — filter */}
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
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
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
                              <span className="text-xs">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </TableHead>

              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <p className="text-muted-foreground/70 text-sm font-medium">Sin resultados</p>
                  <p className="text-muted-foreground/50 mt-1 text-xs">
                    Proba con otros filtros o terminos de busqueda
                  </p>
                  {hasClientFilters && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setCategories(new Set());
                        setStatuses(new Set());
                        setTotalMin("");
                        setTotalMax("");
                        setContribMin("");
                        setContribMax("");
                      }}
                      className="text-primary hover:text-primary/80 mt-3 text-xs transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const isEligible = SELECTABLE_STATUSES.includes(r.siradiqStatus);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        disabled={!isEligible}
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
                      <div className="flex items-center gap-1.5">
                        {statusDot(r.siradiqStatus)}
                        <span className="text-xs">
                          {STATUS_LABELS[r.siradiqStatus] ?? r.siradiqStatus}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
