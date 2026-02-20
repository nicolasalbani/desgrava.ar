"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  DEDUCTION_CATEGORIES,
  DEDUCTION_CATEGORY_LABELS,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
} from "@/lib/validators/invoice";
import { formatCuit, validateCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";

function formatArgNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}

function unformatArgNumber(value: string): string {
  return value.replace(/\D/g, "");
}

const formSchema = z.object({
  deductionCategory: z.string().min(1, "Selecciona una categoria"),
  providerCuit: z
    .string()
    .min(1, "El CUIT es requerido")
    .refine(
      (val) => /^\d{11}$/.test(val.replace(/-/g, "")),
      { message: "CUIT invalido" }
    )
    .refine(
      (val) => validateCuit(val.replace(/-/g, "")),
      { message: "CUIT invalido (digito verificador)" }
    ),
  providerName: z.string().optional(),
  invoiceType: z.string().min(1, "Selecciona un tipo"),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => {
      const num = parseFloat(unformatArgNumber(val));
      return !isNaN(num) && num > 0;
    },
    { message: "El monto debe ser mayor a 0" }
  ),
  fiscalYear: z.string(),
  fiscalMonth: z.string(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function InvoiceForm({
  defaultValues,
  fileData,
}: {
  defaultValues?: Partial<{
    providerCuit: string;
    providerName: string;
    invoiceType: string;
    invoiceNumber: string;
    invoiceDate: string;
    amount: number;
    fiscalYear: number;
    fiscalMonth: number;
    deductionCategory: string;
    description: string;
  }>;
  fileData?: {
    fileBase64: string;
    fileMimeType: string;
    originalFilename: string;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deductionCategory: defaultValues?.deductionCategory ?? "",
      providerCuit: defaultValues?.providerCuit ?? "",
      providerName: defaultValues?.providerName ?? "",
      invoiceType: defaultValues?.invoiceType ?? "",
      invoiceNumber: defaultValues?.invoiceNumber ?? "",
      invoiceDate: defaultValues?.invoiceDate ?? "",
      amount: defaultValues?.amount != null ? String(Math.round(defaultValues.amount)) : "",
      fiscalYear: String(defaultValues?.fiscalYear ?? currentYear),
      fiscalMonth: String(defaultValues?.fiscalMonth ?? currentMonth),
      description: defaultValues?.description ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deductionCategory: data.deductionCategory,
          providerCuit: data.providerCuit.replace(/-/g, ""),
          providerName: data.providerName,
          invoiceType: data.invoiceType,
          invoiceNumber: data.invoiceNumber || undefined,
          invoiceDate: data.invoiceDate || undefined,
          amount: parseFloat(unformatArgNumber(data.amount)),
          fiscalYear: parseInt(data.fiscalYear),
          fiscalMonth: parseInt(data.fiscalMonth),
          description: data.description,
          ...(fileData?.fileBase64 ? {
            fileBase64: fileData.fileBase64,
            fileMimeType: fileData.fileMimeType,
            originalFilename: fileData.originalFilename,
          } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
        return;
      }

      toast.success("Factura cargada correctamente");
      router.push("/facturas");
    } finally {
      setSaving(false);
    }
  }

  function handleCuitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCuit(e.target.value);
    form.setValue("providerCuit", formatted, { shouldValidate: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del comprobante</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria SiRADIG</Label>
            <Select
              value={form.watch("deductionCategory")}
              onValueChange={(v) =>
                form.setValue("deductionCategory", v, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full overflow-hidden">
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {DEDUCTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {DEDUCTION_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.deductionCategory && (
              <p className="text-sm text-destructive">
                {form.formState.errors.deductionCategory.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="providerCuit">CUIT del proveedor</Label>
              <Input
                id="providerCuit"
                placeholder="XX-XXXXXXXX-X"
                {...form.register("providerCuit")}
                onChange={handleCuitChange}
              />
              {form.formState.errors.providerCuit && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.providerCuit.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerName">Nombre del proveedor (opcional)</Label>
              <Input
                id="providerName"
                placeholder="Ej: OSDE, Galeno"
                {...form.register("providerName")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de comprobante</Label>
              <Select
                value={form.watch("invoiceType")}
                onValueChange={(v) =>
                  form.setValue("invoiceType", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {INVOICE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.invoiceType && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.invoiceType.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto ($)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="200.000"
                value={formatArgNumber(form.watch("amount"))}
                onChange={(e) => {
                  const raw = unformatArgNumber(e.target.value);
                  form.setValue("amount", raw, { shouldValidate: true });
                }}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Numero de comprobante (opcional)</Label>
              <Input
                id="invoiceNumber"
                placeholder="00001-00012345"
                {...form.register("invoiceNumber")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Fecha del comprobante (opcional)</Label>
              <Input
                id="invoiceDate"
                type="date"
                {...form.register("invoiceDate")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Año fiscal</Label>
              <Select
                value={form.watch("fiscalYear")}
                onValueChange={(v) =>
                  form.setValue("fiscalYear", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                    (y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mes</Label>
              <Select
                value={form.watch("fiscalMonth")}
                onValueChange={(v) =>
                  form.setValue("fiscalMonth", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((name, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripcion (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Detalle adicional del comprobante"
              {...form.register("description")}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar factura
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/facturas")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
