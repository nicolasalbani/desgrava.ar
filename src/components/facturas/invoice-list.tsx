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
import { Loader2, Trash2 } from "lucide-react";
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
  amount: string;
  fiscalYear: number;
  fiscalMonth: number;
  source: string;
  siradiqStatus: string;
  createdAt: string;
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

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>(String(currentYear));
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    fetchInvoices();
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

  async function handleDelete(id: string) {
    if (!confirm("Seguro que queres eliminar esta factura?")) return;

    const res = await fetch(`/api/facturas/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      toast.success("Factura eliminada");
    } else {
      toast.error("Error al eliminar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los anios</SelectItem>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CUIT Proveedor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    {DEDUCTION_CATEGORY_LABELS[inv.deductionCategory] ??
                      inv.deductionCategory}
                  </TableCell>
                  <TableCell>
                    {INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
