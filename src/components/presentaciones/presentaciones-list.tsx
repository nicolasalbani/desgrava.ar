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
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { JobStatusBadge, type LatestJob } from "@/components/shared/job-status-badge";
import { JobHistoryPanel } from "@/components/shared/job-history-panel";
import { usePaginatedFetch } from "@/hooks/use-paginated-fetch";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PresentacionRow {
  id: string;
  fiscalYear: number;
  numero: number;
  descripcion: string;
  fechaEnvio: string;
  fechaLectura: string | null;
  montoTotal: string | null;
  source: string;
  siradiqStatus: string;
  fileMimeType: string | null;
  originalFilename: string | null;
  hasFile: boolean;
  createdAt: string;
  latestJob: LatestJob | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$ ${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PresentacionesList({ onInitialLoad }: { onInitialLoad?: (count: number) => void }) {
  const { fiscalYear } = useFiscalYear();
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const {
    data: presentaciones,
    pagination,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    setShouldPoll,
  } = usePaginatedFetch<PresentacionRow>({
    url: "/api/presentaciones",
    dataKey: "presentaciones",
    staticParams: useMemo(
      () => ({
        fiscalYear: fiscalYear?.toString(),
      }),
      [fiscalYear],
    ),
    onInitialLoad,
  });

  // Poll while any presentacion has in-flight jobs
  useEffect(() => {
    const hasInFlight = presentaciones.some(
      (p) => p.latestJob?.status === "PENDING" || p.latestJob?.status === "RUNNING",
    );
    setShouldPoll(hasInFlight);
  }, [presentaciones, setShouldPoll]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (presentaciones.length === 0 && pagination.totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
          <Send className="text-muted-foreground/50 h-5 w-5" />
        </div>
        <p className="text-muted-foreground/70 text-sm">No hay presentaciones</p>
        <p className="text-muted-foreground/50 mt-1 text-xs">
          Importa desde ARCA o crea una nueva presentacion
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pagination.totalCount > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {pagination.totalCount}{" "}
            {pagination.totalCount === 1 ? "presentacion" : "presentaciones"}
          </span>
        </div>
      )}

      {/* Mobile card layout */}
      <div className="divide-border divide-y rounded-xl border md:hidden">
        {presentaciones.map((p) => {
          const isExpanded = expandedRowId === p.id;
          const syntheticJob: LatestJob | null =
            p.latestJob ??
            (p.siradiqStatus === "SUBMITTED"
              ? {
                  id: "",
                  status: "COMPLETED",
                  createdAt: p.createdAt,
                  errorMessage: null,
                }
              : null);

          return (
            <div key={p.id}>
              <div className="space-y-2 p-4">
                {/* Row 1: N° + Description */}
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground shrink-0 text-sm font-medium">
                    N° {p.numero}
                  </span>
                  <span className="text-muted-foreground truncate text-sm">{p.descripcion}</span>
                </div>

                {/* Row 2: Dates + Amount */}
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Envio: {formatDate(p.fechaEnvio)}</span>
                  <span className="text-muted-foreground">
                    Lectura: {p.fechaLectura ? formatDate(p.fechaLectura) : "—"}
                  </span>
                  <span className="ml-auto font-mono text-sm">
                    {p.montoTotal ? formatAmount(p.montoTotal) : "—"}
                  </span>
                </div>

                {/* Row 3: Status badge + PDF */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedRowId(isExpanded ? null : p.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <JobStatusBadge job={syntheticJob} />
                    {p.latestJob &&
                      (isExpanded ? (
                        <ChevronUp className="text-muted-foreground/40 h-3 w-3" />
                      ) : (
                        <ChevronDown className="text-muted-foreground/40 h-3 w-3" />
                      ))}
                  </button>
                  {p.hasFile ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8"
                      onClick={() => window.open(`/api/presentaciones/${p.id}/pdf`, "_blank")}
                      title="Descargar PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground/30 text-sm">—</span>
                  )}
                </div>
              </div>

              {/* Expanded job history */}
              {isExpanded && (
                <div className="bg-muted/20 border-border border-t px-4 py-3">
                  <JobHistoryPanel
                    entityId={p.id}
                    entityType="presentacion"
                    latestJobStatus={p.latestJob?.status}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table layout */}
      <div className="border-border hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">N°</TableHead>
              <TableHead>Descripcion</TableHead>
              <TableHead>Fecha de Envio</TableHead>
              <TableHead>Fecha de Lectura</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead>SiRADIG</TableHead>
              <TableHead className="w-16 text-right">PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presentaciones.map((p) => {
              const isExpanded = expandedRowId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(p.fechaEnvio)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.fechaLectura ? formatDate(p.fechaLectura) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {p.montoTotal ? formatAmount(p.montoTotal) : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => setExpandedRowId(isExpanded ? null : p.id)}
                        className="inline-flex items-center gap-1"
                      >
                        <JobStatusBadge
                          job={
                            p.latestJob ??
                            (p.siradiqStatus === "SUBMITTED"
                              ? {
                                  id: "",
                                  status: "COMPLETED",
                                  createdAt: p.createdAt,
                                  errorMessage: null,
                                }
                              : null)
                          }
                        />
                        {p.latestJob &&
                          (isExpanded ? (
                            <ChevronUp className="text-muted-foreground/40 h-3 w-3" />
                          ) : (
                            <ChevronDown className="text-muted-foreground/40 h-3 w-3" />
                          ))}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.hasFile ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-8 w-8"
                          onClick={() => window.open(`/api/presentaciones/${p.id}/pdf`, "_blank")}
                          title="Descargar PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/30 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${p.id}-history`}>
                      <TableCell colSpan={7} className="bg-muted/20 px-6 py-3">
                        <JobHistoryPanel
                          entityId={p.id}
                          entityType="presentacion"
                          latestJobStatus={p.latestJob?.status}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
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
    </div>
  );
}
