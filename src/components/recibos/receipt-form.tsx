"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { MESES } from "@/lib/validators/domestic";

const schema = z.object({
  domesticWorkerId: z.string().optional(),
  fiscalMonth: z.number().int().min(1).max(12),
  total: z.string().min(1, "El total es requerido"),
  basico: z.string().optional(),
  antiguedad: z.string().optional(),
  viaticos: z.string().optional(),
  presentismo: z.string().optional(),
  otros: z.string().optional(),
  contributionAmount: z.string().optional(),
  contributionDate: z.string().optional(),
  categoriaProfesional: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Worker {
  id: string;
  apellidoNombre: string;
  cuil: string;
}

export function ReceiptForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? new Date().getFullYear();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      domesticWorkerId: "",
      fiscalMonth: new Date().getMonth() + 1,
      total: "",
      basico: "",
      antiguedad: "",
      viaticos: "",
      presentismo: "",
      otros: "",
      contributionAmount: "",
      contributionDate: "",
      categoriaProfesional: "Personal para tareas generales",
    },
  });

  useEffect(() => {
    fetch(`/api/trabajadores?fiscalYear=${year}`)
      .then((r) => r.json())
      .then((d) => setWorkers(d.workers ?? []))
      .catch(() => {});
  }, [year]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const month = data.fiscalMonth;
      const periodo = `${MESES[month - 1]} ${year}`;

      const body = {
        fiscalYear: year,
        fiscalMonth: month,
        periodo,
        domesticWorkerId: data.domesticWorkerId || undefined,
        total: parseFloat(data.total),
        basico: data.basico ? parseFloat(data.basico) : undefined,
        antiguedad: data.antiguedad ? parseFloat(data.antiguedad) : undefined,
        viaticos: data.viaticos ? parseFloat(data.viaticos) : undefined,
        presentismo: data.presentismo ? parseFloat(data.presentismo) : undefined,
        otros: data.otros ? parseFloat(data.otros) : undefined,
        contributionAmount: data.contributionAmount
          ? parseFloat(data.contributionAmount)
          : undefined,
        contributionDate: data.contributionDate || undefined,
        categoriaProfesional: data.categoriaProfesional || undefined,
      };

      const res = await fetch("/api/recibos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }

      toast.success("Recibo creado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-1">
      {/* Worker selector */}
      <div className="space-y-1.5">
        <Label>Trabajador</Label>
        <Controller
          control={form.control}
          name="domesticWorkerId"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar trabajador..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.apellidoNombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Period */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mes</Label>
          <Controller
            control={form.control}
            name="fiscalMonth"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((mes, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ano fiscal</Label>
          <Input value={year} disabled className="w-full" />
        </div>
      </div>

      {/* Amounts */}
      <div className="space-y-1.5">
        <Label>Total (retribucion)</Label>
        <Input {...form.register("total")} placeholder="0.00" />
        {form.formState.errors.total && (
          <p className="text-destructive text-xs">{form.formState.errors.total.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            Basico <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
          </Label>
          <Input {...form.register("basico")} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>
            Antiguedad{" "}
            <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
          </Label>
          <Input {...form.register("antiguedad")} placeholder="0.00" />
        </div>
      </div>

      <div className="border-border border-t" />

      {/* Contribution */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            Contribucion (aportes){" "}
            <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
          </Label>
          <Input {...form.register("contributionAmount")} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>
            Fecha de pago{" "}
            <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
          </Label>
          <Input {...form.register("contributionDate")} placeholder="dd/mm/aaaa" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear recibo
        </Button>
      </div>
    </form>
  );
}
