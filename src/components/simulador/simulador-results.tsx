"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SimuladorChart } from "./simulador-chart";

function formatMoney(value: string): string {
  const num = parseFloat(value);
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function SimuladorResults({ result }: { result: SimulationResult }) {
  const ahorro = parseFloat(result.ahorroAnual);

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tu ahorro estimado anual</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatMoney(result.ahorroAnual)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(result.ahorroMensual)} por mes
                </p>
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

      {ahorro > 0 && <SimuladorChart result={result} />}

      <Card>
        <CardHeader>
          <CardTitle>Desglose del calculo</CardTitle>
          <CardDescription>
            Detalle paso a paso de como se calcula tu impuesto a las ganancias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Salario bruto anual (13 sueldos)</TableCell>
                <TableCell className="text-right">{formatMoney(result.salarioBrutoAnual)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Aportes obligatorios</TableCell>
                <TableCell className="text-right text-destructive">-{formatMoney(result.deduccionesMandatorias)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">Ganancia neta anual</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(result.gananciaNetaAnual)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Deducciones personales</TableCell>
                <TableCell className="text-right text-destructive">-{formatMoney(result.deduccionesPersonales)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Deducciones por comprobantes (SiRADIG)</TableCell>
                <TableCell className="text-right text-destructive">-{formatMoney(result.deduccionesPorComprobantes)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">Ganancia imponible SIN deducciones SiRADIG</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(result.gananciaImponibleSinDeducciones)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">Ganancia imponible CON deducciones SiRADIG</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(result.gananciaImponibleConDeducciones)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Impuesto SIN deducciones
                  <Badge variant="secondary" className="ml-2">tasa {result.tasaEfectivaSin}%</Badge>
                </TableCell>
                <TableCell className="text-right">{formatMoney(result.impuestoSinDeducciones)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Impuesto CON deducciones
                  <Badge variant="secondary" className="ml-2">tasa {result.tasaEfectivaCon}%</Badge>
                </TableCell>
                <TableCell className="text-right">{formatMoney(result.impuestoConDeducciones)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-green-600">AHORRO ANUAL</TableCell>
                <TableCell className="text-right font-bold text-green-600">{formatMoney(result.ahorroAnual)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.detalleDeduciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de deducciones</CardTitle>
            <CardDescription>Como se calcula cada deduccion segun las reglas de SiRADIG</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Monto anual</TableHead>
                  <TableHead className="text-right">Deducible</TableHead>
                  <TableHead className="hidden md:table-cell">Regla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detalleDeduciones.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-right">{formatMoney(d.inputAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(d.deductibleAmount)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{d.notes}</TableCell>
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
