"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Trash2, Send } from "lucide-react";
import {
  DEDUCTION_CATEGORY_LABELS,
  INVOICE_TYPE_LABELS,
} from "@/lib/validators/invoice";
import { toast } from "sonner";

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
  createdAt: string;
  _count: { automationJobs: number };
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>(String(currentYear));
  const [status, setStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
    setSelectedIds(new Set());
  }, [year, status]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year !== "all") params.set("fiscalYear", year);
      if (status !== "all") params.set("status", status);

      const res = await fetch(`/api/facturas?${params}`);
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

  const eligibleInvoices = invoices.filter((inv) =>
    SELECTABLE_STATUSES.includes(inv.siradiqStatus)
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
              inv.id === invoiceId ? { ...inv, siradiqStatus: "QUEUED" } : inv
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

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los años</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} factura(s) seleccionada(s)
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
            Cancelar seleccion
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No hay facturas cargadas para los filtros seleccionados.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table className="table-fixed w-full">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    checked={allEligibleSelected && eligibleInvoices.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todas"
                    disabled={eligibleInvoices.length === 0}
                  />
                </TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nro. Comprobante</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const isEligible = SELECTABLE_STATUSES.includes(inv.siradiqStatus);
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        disabled={!isEligible}
                        aria-label={`Seleccionar factura ${inv.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium truncate" title={inv.providerName || "—"}>
                      {inv.providerName || "—"}
                    </TableCell>
                    <TableCell className="truncate" title={DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ?? inv.deductionCategory}>
                      {DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ??
                        inv.deductionCategory}
                    </TableCell>
                    <TableCell>
                      {INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {inv.invoiceNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      {inv.invoiceDate
                        ? new Date(inv.invoiceDate).toLocaleDateString("es-AR")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {inv.providerCuit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${parseFloat(inv.amount).toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>
                      {inv.fiscalMonth}/{inv.fiscalYear}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[inv.siradiqStatus] ?? "secondary"}>
                        {STATUS_LABELS[inv.siradiqStatus] ?? inv.siradiqStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.source}</Badge>
                    </TableCell>
                    <TableCell>
                      {inv._count.automationJobs > 0 ? (
                        <span title="Tiene automatizaciones vinculadas">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(inv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
            <AlertDialogAction onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
