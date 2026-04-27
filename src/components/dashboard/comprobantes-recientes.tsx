"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/simulador/deduction-rules";
import { formatCuit } from "@/lib/validators/cuit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RecentInvoice {
  id: string;
  providerName: string | null;
  providerCuit: string;
  deductionCategory: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: number;
  siradiqStatus: string;
}

interface ComprobantesRecientesProps {
  invoices: RecentInvoice[];
  totalCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  SUBMITTED: "Desgravado",
  FAILED: "Falló",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  QUEUED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PROCESSING: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SUBMITTED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAILED: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-500",
  QUEUED: "bg-blue-500",
  PROCESSING: "bg-blue-500",
  SUBMITTED: "bg-emerald-500",
  FAILED: "bg-red-500",
};

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-AR");
}

function shortCategory(category: string): string {
  const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
  if (label.length > 28) return label.slice(0, 25) + "…";
  return label;
}

export function ComprobantesRecientes({ invoices, totalCount }: ComprobantesRecientesProps) {
  return (
    <div
      data-tour="comprobantes-recientes"
      className="bg-card border-border animate-in fade-in slide-in-from-bottom-2 rounded-2xl border p-5 duration-500"
      style={{ animationDelay: "250ms", animationFillMode: "backwards" }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Comprobantes recientes</h2>
          {invoices.length > 0 && (
            <p className="text-muted-foreground/70 mt-0.5 text-xs">
              {invoices.length} de {totalCount} este año fiscal
            </p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href="/facturas?spotlight=upload">
            <Plus className="h-3.5 w-3.5" />
            Cargar comprobante
          </Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="py-6 text-center">
          <FileText className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Todavía no tenés comprobantes deducibles. Importalos desde ARCA o cargalos manualmente.
          </p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link href="/facturas">Ir a comprobantes</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="divide-border divide-y sm:hidden">
            {invoices.map((invoice) => {
              const providerLabel = invoice.providerName?.trim() || invoice.providerCuit;
              const statusLabel = STATUS_LABEL[invoice.siradiqStatus] ?? invoice.siradiqStatus;
              const statusTone =
                STATUS_TONE[invoice.siradiqStatus] ?? "bg-muted text-muted-foreground";
              const statusDot = STATUS_DOT[invoice.siradiqStatus] ?? "bg-muted-foreground";
              return (
                <li key={invoice.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground truncate text-sm font-medium">
                      {providerLabel}
                    </span>
                    <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                      {formatARS(invoice.amount)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span className="truncate">{shortCategory(invoice.deductionCategory)}</span>
                    <span>{formatDate(invoice.invoiceDate)}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      statusTone,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
                    {statusLabel}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Tablet+: table with headers, columns matching /facturas */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground h-9 text-xs font-medium">
                    Proveedor
                  </TableHead>
                  <TableHead className="text-muted-foreground h-9 text-xs font-medium">
                    Categoria
                  </TableHead>
                  <TableHead className="text-muted-foreground h-9 text-xs font-medium">
                    Nro. Comprobante
                  </TableHead>
                  <TableHead className="text-muted-foreground h-9 text-xs font-medium">
                    Fecha
                  </TableHead>
                  <TableHead className="text-muted-foreground h-9 text-right text-xs font-medium">
                    Monto
                  </TableHead>
                  <TableHead className="text-muted-foreground h-9 text-xs font-medium">
                    SiRADIG
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const providerLabel = invoice.providerName?.trim() || invoice.providerCuit;
                  const statusLabel = STATUS_LABEL[invoice.siradiqStatus] ?? invoice.siradiqStatus;
                  const statusTone =
                    STATUS_TONE[invoice.siradiqStatus] ?? "bg-muted text-muted-foreground";
                  const statusDot = STATUS_DOT[invoice.siradiqStatus] ?? "bg-muted-foreground";
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate text-sm font-medium">{providerLabel}</div>
                        {invoice.providerName && (
                          <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                            {formatCuit(invoice.providerCuit)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                        {shortCategory(invoice.deductionCategory)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {invoice.invoiceNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(invoice.invoiceDate)}
                      </TableCell>
                      <TableCell className="text-foreground text-right text-sm font-semibold tabular-nums">
                        {formatARS(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            statusTone,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
                          {statusLabel}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
