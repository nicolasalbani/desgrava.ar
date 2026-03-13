"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { SimulationResult } from "@/lib/simulador/calculator";

type ViewMode = "mensual" | "anual";

function formatMoney(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function scaled(value: string, divisor: number): number {
  return parseFloat(value) / divisor;
}

export function SimuladorResults({ result }: { result: SimulationResult }) {
  const [viewMode, setViewMode] = useState<ViewMode>("mensual");
  const ahorro = parseFloat(result.ahorroAnual);
  const d = viewMode === "mensual" ? 12 : 1;
  const label = viewMode === "mensual" ? "mensual" : "anual";

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-muted-foreground text-sm">Tu ahorro estimado</p>
                  <div className="inline-flex rounded-md border text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("mensual")}
                      className={`rounded-l-md px-2 py-0.5 transition-colors ${viewMode === "mensual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      Mensual
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("anual")}
                      className={`rounded-r-md px-2 py-0.5 transition-colors ${viewMode === "anual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      Anual
                    </button>
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatMoney(scaled(result.ahorroAnual, d))}
                  <span className="text-muted-foreground ml-1 text-base font-normal">
                    /{viewMode === "mensual" ? "mes" : "año"}
                  </span>
                </p>
                {viewMode === "mensual" && (
                  <p className="text-muted-foreground text-sm">
                    {formatMoney(result.ahorroAnual)} por año
                  </p>
                )}
                {viewMode === "anual" && (
                  <p className="text-muted-foreground text-sm">
                    {formatMoney(result.ahorroMensual)} por mes
                  </p>
                )}
              </div>
            </div>
            {ahorro > 0 && (
              <Button asChild size="lg">
                <Link href="/login">
                  Empezar a desgravar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desglose del calculo ({label})</CardTitle>
          <CardDescription>
            Detalle paso a paso de como se calcula tu impuesto a las ganancias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[65%]" />
              <col className="w-[35%]" />
            </colgroup>
            <TableBody>
              <TableRow>
                <TableCell
                  className="truncate font-medium"
                  title={`Salario bruto ${viewMode === "mensual" ? "(incl. aguinaldo)" : "(13 sueldos)"}`}
                >
                  Salario bruto {viewMode === "mensual" ? "(incl. aguinaldo)" : "(13 sueldos)"}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(scaled(result.salarioBrutoAnual, d))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="truncate font-medium" title="Aportes obligatorios">
                  Aportes obligatorios
                </TableCell>
                <TableCell className="text-destructive text-right">
                  -{formatMoney(scaled(result.deduccionesMandatorias, d))}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="truncate font-semibold" title="Ganancia neta">
                  Ganancia neta
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(scaled(result.gananciaNetaAnual, d))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="truncate font-medium" title="Deducciones personales">
                  Deducciones personales
                </TableCell>
                <TableCell className="text-destructive text-right">
                  -{formatMoney(scaled(result.deduccionesPersonales, d))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  className="truncate font-medium"
                  title="Deducciones por comprobantes (SiRADIG)"
                >
                  Deducciones por comprobantes (SiRADIG)
                </TableCell>
                <TableCell className="text-destructive text-right">
                  -{formatMoney(scaled(result.deduccionesPorComprobantes, d))}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell
                  className="truncate font-semibold"
                  title="Ganancia imponible SIN deducciones SiRADIG"
                >
                  Ganancia imponible SIN deducciones SiRADIG
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(scaled(result.gananciaImponibleSinDeducciones, d))}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell
                  className="truncate font-semibold"
                  title="Ganancia imponible CON deducciones SiRADIG"
                >
                  Ganancia imponible CON deducciones SiRADIG
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(scaled(result.gananciaImponibleConDeducciones, d))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  className="truncate font-medium"
                  title={`Impuesto SIN deducciones (tasa ${result.tasaEfectivaSin}%)`}
                >
                  Impuesto SIN deducciones
                  <Badge variant="secondary" className="ml-2">
                    tasa {result.tasaEfectivaSin}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(scaled(result.impuestoSinDeducciones, d))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  className="truncate font-medium"
                  title={`Impuesto CON deducciones (tasa ${result.tasaEfectivaCon}%)`}
                >
                  Impuesto CON deducciones
                  <Badge variant="secondary" className="ml-2">
                    tasa {result.tasaEfectivaCon}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(scaled(result.impuestoConDeducciones, d))}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell
                  className="truncate font-bold text-green-600"
                  title={`AHORRO ${viewMode === "mensual" ? "MENSUAL" : "ANUAL"}`}
                >
                  AHORRO {viewMode === "mensual" ? "MENSUAL" : "ANUAL"}
                </TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatMoney(scaled(result.ahorroAnual, d))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.detalleDeduciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de deducciones ({label})</CardTitle>
            <CardDescription>
              Como se calcula cada deduccion segun las reglas de SiRADIG
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[35%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="hidden w-[29%] md:table-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Deducible</TableHead>
                  <TableHead className="hidden md:table-cell">Regla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detalleDeduciones.map((det, i) => (
                  <TableRow key={i}>
                    <TableCell className="truncate font-medium" title={det.label}>
                      {det.label}
                    </TableCell>
                    <TableCell
                      className="truncate text-right"
                      title={formatMoney(scaled(det.inputAmount, d))}
                    >
                      {formatMoney(scaled(det.inputAmount, d))}
                    </TableCell>
                    <TableCell
                      className="truncate text-right font-semibold"
                      title={formatMoney(scaled(det.deductibleAmount, d))}
                    >
                      {formatMoney(scaled(det.deductibleAmount, d))}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground hidden truncate text-sm md:table-cell"
                      title={det.notes}
                    >
                      {det.notes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
