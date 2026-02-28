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
} from "lucide-react";
import {
  DEDUCTION_CATEGORIES,
  DEDUCTION_CATEGORY_LABELS,
} from "@/lib/validators/invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  _count: { automationJobs: number };
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  QUEUED: "outline",
  PROCESSING: "outline",
  PREVIEW_READY: "outline",
  CONFIRMED: "default",
  SUBMITTED: "default",
  FAILED: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  PREVIEW_READY: "Preview listo",
  CONFIRMED: "Confirmado",
  SUBMITTED: "Enviado",
  FAILED: "Error",
};

const SELECTABLE_STATUSES = ["PENDING", "FAILED"];

function isFutureMonth(inv: Invoice): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (
    inv.fiscalYear > currentYear ||
    (inv.fiscalYear === currentYear && inv.fiscalMonth > currentMonth)
  );
}

export function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await fetch("/api/facturas");
      const data = await res.json();
      setInvoices(data.invoices || []);
    } finally {
      setLoading(false);
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
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Error al eliminar");
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

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (categories.size > 0 && !categories.has(inv.deductionCategory))
        return false;
      if (statuses.size > 0 && !statuses.has(inv.siradiqStatus))
        return false;
      if (fechaDesde) {
        if (!inv.invoiceDate) return false;
        if (new Date(inv.invoiceDate) < new Date(fechaDesde)) return false;
      }
      if (fechaHasta) {
        if (!inv.invoiceDate) return false;
        if (new Date(inv.invoiceDate) > new Date(fechaHasta)) return false;
      }
      if (montoMin) {
        const min = parseInt(montoMin);
        if (!isNaN(min) && parseFloat(inv.amount) < min) return false;
      }
      if (montoMax) {
        const max = parseInt(montoMax);
        if (!isNaN(max) && parseFloat(inv.amount) > max) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !inv.providerName?.toLowerCase().includes(q) &&
          !inv.providerCuit.includes(q) &&
          !inv.invoiceNumber?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [
    invoices,
    categories,
    statuses,
    fechaDesde,
    fechaHasta,
    montoMin,
    montoMax,
    search,
  ]);

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

  const eligibleInvoices = filteredInvoices.filter(
    (inv) =>
      SELECTABLE_STATUSES.includes(inv.siradiqStatus) && !isFutureMonth(inv)
  );
  const allEligibleSelected =
    eligibleInvoices.length > 0 &&
    eligibleInvoices.every((inv) => selectedIds.has(inv.id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleInvoices.map((inv) => inv.id)));
    }
  }

  async function handleSubmitToSiradig() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);

    let successCount = 0;
    let failCount = 0;
    const failedIds = new Set<string>();

    for (const invoiceId of selectedIds) {
      try {
        const res = await fetch("/api/automatizacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId, jobType: "SUBMIT_INVOICE" }),
        });
        if (res.ok) {
          successCount++;
          setInvoices((prev) =>
            prev.map((inv) =>
              inv.id === invoiceId
                ? { ...inv, siradiqStatus: "QUEUED" }
                : inv
            )
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
      toast.success(
        `${successCount} factura(s) enviada(s) a la cola de SiRADIG`
      );
    }
    if (failCount > 0) {
      toast.error(`${failCount} factura(s) no se pudieron enviar`);
    }

    setSelectedIds(failedIds);
    setSubmitting(false);
  }

  // --- Filter active helpers ---
  const isCategoryActive = categories.size > 0;
  const isFechaActive = fechaDesde !== "" || fechaHasta !== "";
  const isMontoActive = montoMin !== "" || montoMax !== "";
  const isStatusActive = statuses.size > 0;

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
        {!loading && invoices.length > 0 && (
          <span className="text-sm text-muted-foreground tabular-nums shrink-0">
            {hasClientFilters
              ? `${filteredInvoices.length} de ${invoices.length}`
              : invoices.length}{" "}
            {invoices.length === 1 && !hasClientFilters
              ? "comprobante"
              : "comprobantes"}
          </span>
        )}
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-5 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <Button
            size="sm"
            onClick={handleSubmitToSiradig}
            disabled={submitting}
          >
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
            onClick={() => setSelectedIds(new Set())}
            disabled={submitting}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted/40 p-4 mb-4">
            <FileText className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/70">
            Sin comprobantes
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs">
            No hay facturas cargadas
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={
                      allEligibleSelected && eligibleInvoices.length > 0
                    }
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
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-60 p-3"
                        align="start"
                      >
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
                                      if (checked) {
                                        next.add(cat);
                                      } else {
                                        next.delete(cat);
                                      }
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
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-52 p-3"
                        align="start"
                      >
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
                              onChange={(e) =>
                                setFechaDesde(e.target.value)
                              }
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
                              onChange={(e) =>
                                setFechaHasta(e.target.value)
                              }
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
                              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-44 p-3"
                        align="end"
                      >
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
                                setMontoMin(
                                  e.target.value.replace(/[^\d]/g, "")
                                )
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
                                setMontoMax(
                                  e.target.value.replace(/[^\d]/g, "")
                                )
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

                {/* Estado — funnel */}
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
                      <PopoverContent
                        className="w-44 p-3"
                        align="start"
                      >
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
                            {Object.entries(STATUS_LABELS).map(
                              ([key, label]) => (
                                <label
                                  key={key}
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
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
                              )
                            )}
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
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-12"
                  >
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
                filteredInvoices.map((inv) => {
                  const isFuture = isFutureMonth(inv);
                  const isEligible =
                    SELECTABLE_STATUSES.includes(inv.siradiqStatus) &&
                    !isFuture;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={() => toggleSelect(inv.id)}
                          disabled={!isEligible}
                          title={
                            isFuture
                              ? "No disponible: el periodo fiscal aun no esta habilitado en SiRADIG"
                              : undefined
                          }
                          aria-label={`Seleccionar factura ${inv.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {inv.providerName || inv.providerCuit}
                          </p>
                          {inv.providerName && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {inv.providerCuit}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span
                          className="block truncate text-sm text-muted-foreground"
                          title={DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ?? inv.deductionCategory}
                        >
                          {DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ?? inv.deductionCategory}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.invoiceNumber ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.invoiceDate
                          ? new Date(inv.invoiceDate).toLocaleDateString(
                              "es-AR"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium tabular-nums">
                        ${parseFloat(inv.amount).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_VARIANTS[inv.siradiqStatus] ?? "secondary"
                          }
                        >
                          {STATUS_LABELS[inv.siradiqStatus] ??
                            inv.siradiqStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {inv.hasFile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Ver comprobante"
                            >
                              <a
                                href={`/api/facturas/${inv.id}/file`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileDown className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {inv._count.automationJobs > 0 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled
                              title="Tiene automatizaciones vinculadas"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(inv.id)}
                              title="Eliminar"
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la factura
              permanentemente.
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
