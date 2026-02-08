"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SimulationResult } from "@/lib/simulador/calculator";

function formatCompact(value: number): string {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(0) + "k";
  return "$" + value;
}

export function SimuladorChart({ result, viewMode = "mensual" }: { result: SimulationResult; viewMode?: "mensual" | "anual" }) {
  const d = viewMode === "mensual" ? 12 : 1;
  const data = [
    { name: "Sin deducciones", impuesto: parseFloat(result.impuestoSinDeducciones) / d },
    { name: "Con deducciones", impuesto: parseFloat(result.impuestoConDeducciones) / d },
  ];

  const colors = ["hsl(0, 70%, 55%)", "hsl(142, 70%, 45%)"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparacion de impuesto</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={80}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
              <Tooltip
                formatter={(value) => {
                  if (typeof value !== "number") return "";
                  return value.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    minimumFractionDigits: 0,
                  });
                }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Bar dataKey="impuesto" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
