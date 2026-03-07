"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEDUCTION_CATEGORY_LABELS } from "@/lib/validators/invoice";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface PendingInvoice {
  id: string;
  providerName: string | null;
  providerCuit: string;
  deductionCategory: string;
  invoiceDate: string | null;
  amount: string;
  siradiqStatus: string;
  _count: { automationJobs: number };
  fiscalYear: number;
  fiscalMonth: number;
}

function isFutureMonth(inv: PendingInvoice): boolean {
  const now = new Date();
  return (
    inv.fiscalYear > now.getFullYear() ||
    (inv.fiscalYear === now.getFullYear() && inv.fiscalMonth > now.getMonth() + 1)
  );
}

interface PendingInvoicesPanelProps {
  onSubmitted: () => void;
  onRegisterRefresh?: (fn: () => void) => void;
}

export function PendingInvoicesPanel({ onSubmitted, onRegisterRefresh }: PendingInvoicesPanelProps) {
  const { fiscalYear } = useFiscalYear();
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (fiscalYear === null) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/facturas");
      const data = await res.json();
      const all: PendingInvoice[] = data.invoices || [];
      const pending = all.filter((inv) =>
        ["PENDING", "FAILED"].includes(inv.siradiqStatus) &&
        inv.fiscalYear === fiscalYear
      );
      setInvoices(pending);
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    onRegisterRefresh?.(fetchInvoices);
  }, [onRegisterRefresh, fetchInvoices]);

  const eligibleInvoices = invoices.filter((inv) => !isFutureMonth(inv));
  const allSelected =
    eligibleInvoices.length > 0 &&
    eligibleInvoices.every((inv) => selectedIds.has(inv.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleInvoices.map((inv) => inv.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);

    let successCount = 0;
    let failCount = 0;

    for (const invoiceId of selectedIds) {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv && inv.fiscalYear !== fiscalYear) {
        toast.error(
          `"${inv.providerName || inv.providerCuit}" es del año ${inv.fiscalYear}, pero el año fiscal activo es ${fiscalYear}.`,
          { duration: 6000 }
        );
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
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      toast.success(`${successCount} factura(s) enviada(s) a la cola de SiRADIG`);
      setInvoices((prev) => prev.filter((inv) => !selectedIds.has(inv.id)));
      setSelectedIds(new Set());
      onSubmitted();
    }
    if (failCount > 0) {
      toast.error(`${failCount} factura(s) no se pudieron enviar`);
    }
  }

  if (fiscalYear === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
        <div className="rounded-full bg-muted/40 p-3 mb-3">
          <FileText className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/70">Seleccioná un año fiscal</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Elegí el período fiscal desde el menú superior para ver las facturas pendientes
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
        <div className="rounded-full bg-muted/40 p-3 mb-3">
          <FileText className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/70">Sin facturas pendientes para {fiscalYear}</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Todas las facturas de {fiscalYear} ya fueron enviadas a SiRADIG
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-5 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
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

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected && eligibleInvoices.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Seleccionar todas"
                  disabled={eligibleInvoices.length === 0}
                />
              </TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const future = isFutureMonth(inv);
              return (
                <TableRow key={inv.id} className={future ? "opacity-50" : ""}>
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedIds.has(inv.id)}
                      onCheckedChange={() => toggleSelect(inv.id)}
                      disabled={future}
                      title={
                        future
                          ? "El periodo fiscal aun no esta habilitado en SiRADIG"
                          : undefined
                      }
                      aria-label={`Seleccionar factura ${inv.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">
                      {inv.providerName || inv.providerCuit}
                    </p>
                    {inv.providerName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.providerCuit}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="block truncate text-sm text-muted-foreground" title={DEDUCTION_CATEGORY_LABELS[inv.deductionCategory]}>
                      {DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ?? inv.deductionCategory}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.invoiceDate
                      ? new Date(inv.invoiceDate).toLocaleDateString("es-AR")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium tabular-nums">
                    ${parseFloat(inv.amount).toLocaleString("es-AR")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
