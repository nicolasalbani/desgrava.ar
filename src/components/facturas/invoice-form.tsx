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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  DEDUCTION_CATEGORIES,
  DEDUCTION_CATEGORY_LABELS,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
} from "@/lib/validators/invoice";
import { formatCuit, validateCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/fiscal-year";

function formatArgNumber(value: string): string {
  if (!value) return "";
  const [intPart, decPart] = value.split(".");
  const digits = intPart.replace(/\D/g, "");
  if (!digits && decPart === undefined) return "";
  const formatted = digits ? Number(digits).toLocaleString("es-AR") : "0";
  if (decPart !== undefined) return formatted + "," + decPart;
  return formatted;
}

function unformatArgNumber(value: string): string {
  const parts = value.split(",");
  const intPart = parts[0].replace(/\./g, "").replace(/\D/g, "");
  if (parts.length > 1) {
    const decPart = parts[1].replace(/\D/g, "").slice(0, 2);
    return intPart + "." + decPart;
  }
  return intPart;
}

const formSchema = z
  .object({
    deductionCategory: z.string().min(1, "Selecciona una categoria"),
    providerCuit: z
      .string()
      .min(1, "El CUIT es requerido")
      .refine((val) => /^\d{11}$/.test(val.replace(/-/g, "")), { message: "CUIT invalido" })
      .refine((val) => validateCuit(val.replace(/-/g, "")), {
        message: "CUIT invalido (digito verificador)",
      }),
    providerName: z.string().min(1, "El nombre del proveedor es requerido"),
    invoiceType: z.string().min(1, "Selecciona un tipo"),
    invoiceNumber: z.string().min(1, "El numero de comprobante es requerido"),
    invoiceDate: z.string().min(1, "La fecha del comprobante es requerida"),
    amount: z
      .string()
      .min(1, "El monto es requerido")
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        },
        { message: "El monto debe ser mayor a 0" },
      ),
    fiscalYear: z.string(),
    fiscalMonth: z.string(),
    description: z.string().optional(),
    contractStartDate: z.string().optional(),
    contractEndDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.invoiceDate) return true;
      const invoiceYear = parseInt(data.invoiceDate.split("-")[0]);
      return invoiceYear === parseInt(data.fiscalYear);
    },
    {
      message: "La fecha del comprobante no corresponde al año fiscal seleccionado",
      path: ["invoiceDate"],
    },
  );

type FormData = z.infer<typeof formSchema>;

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function InvoiceForm({
  invoiceId,
  defaultValues,
  fileData,
  invoiceRawText,
  onSaved,
  onCancel,
}: {
  invoiceId?: string;
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
    contractStartDate: string;
    contractEndDate: string;
    familyDependentId: string;
  }>;
  fileData?: {
    fileBase64: string;
    fileMimeType: string;
    originalFilename: string;
  };
  invoiceRawText?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { fiscalYear: contextFiscalYear } = useFiscalYear();
  const isNew = !invoiceId;
  const lockedYear = isNew && contextFiscalYear !== null ? contextFiscalYear : null;
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [lookingUpName, setLookingUpName] = useState(false);
  const lastLookedUpCuit = useRef("");
  const lastLookedUpNameCuit = useRef("");

  const [familyDependentId, setFamilyDependentId] = useState<string>(
    defaultValues?.familyDependentId ?? "",
  );
  const [dependents, setDependents] = useState<{ id: string; nombre: string; apellido: string }[]>(
    [],
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deductionCategory: defaultValues?.deductionCategory ?? "",
      providerCuit: defaultValues?.providerCuit ?? "",
      providerName: defaultValues?.providerName ?? "",
      invoiceType: defaultValues?.invoiceType ?? "",
      invoiceNumber: defaultValues?.invoiceNumber ?? "",
      invoiceDate: defaultValues?.invoiceDate ?? "",
      amount: defaultValues?.amount != null ? String(defaultValues.amount) : "",
      fiscalYear: String(lockedYear ?? defaultValues?.fiscalYear ?? currentYear),
      fiscalMonth: String(defaultValues?.fiscalMonth ?? currentMonth),
      description: defaultValues?.description ?? "",
      contractStartDate: defaultValues?.contractStartDate ?? "",
      contractEndDate: defaultValues?.contractEndDate ?? "",
    },
  });

  const watchedFiscalYear = form.watch("fiscalYear");

  useEffect(() => {
    const year = parseInt(watchedFiscalYear);
    if (!isNaN(year)) {
      fetch(`/api/cargas-familia?year=${year}`)
        .then((res) => res.json())
        .then((data) => setDependents(data.dependents || []))
        .catch(() => setDependents([]));
    }
  }, [watchedFiscalYear]);

  const fetchLastCategory = useCallback(
    async (rawCuit: string) => {
      const cuit = rawCuit.replace(/-/g, "");
      if (cuit.length !== 11 || !validateCuit(cuit) || cuit === lastLookedUpCuit.current) return;
      lastLookedUpCuit.current = cuit;

      try {
        const res = await fetch(`/api/facturas/last-category?cuit=${cuit}`);
        if (!res.ok) return;
        const { category } = await res.json();
        if (category && !form.getValues("deductionCategory")) {
          form.setValue("deductionCategory", category, { shouldValidate: true });
          return;
        }
      } catch {
        // silently ignore — suggestion is best-effort
      }

      // Fallback: classify via LLM if no prior category and raw text is available
      if (!form.getValues("deductionCategory") && invoiceRawText) {
        setClassifying(true);
        try {
          const res = await fetch("/api/facturas/classify-category", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: invoiceRawText,
              cuit: form.getValues("providerCuit") || undefined,
            }),
          });
          if (!res.ok) return;
          const { category } = await res.json();
          if (category && !form.getValues("deductionCategory")) {
            form.setValue("deductionCategory", category, { shouldValidate: true });
          }
        } catch {
          // silently ignore — classification is best-effort
        } finally {
          setClassifying(false);
        }
      }
    },
    [form, invoiceRawText],
  );

  const fetchProviderName = useCallback(
    async (rawCuit: string) => {
      const cuit = rawCuit.replace(/-/g, "");
      if (cuit.length !== 11 || !validateCuit(cuit) || cuit === lastLookedUpNameCuit.current)
        return;
      lastLookedUpNameCuit.current = cuit;

      setLookingUpName(true);
      try {
        const res = await fetch(`/api/cuit-lookup?cuit=${cuit}`);
        if (!res.ok) return;
        const { razonSocial } = await res.json();
        if (razonSocial) {
          form.setValue("providerName", razonSocial, { shouldValidate: true });
        } else {
          form.setValue("providerName", "", { shouldValidate: false });
        }
      } catch {
        // silently ignore — lookup is best-effort
      } finally {
        setLookingUpName(false);
      }
    },
    [form],
  );

  useEffect(() => {
    if (defaultValues?.providerCuit) {
      fetchLastCategory(defaultValues.providerCuit);
      fetchProviderName(defaultValues.providerCuit);
    }
  }, [defaultValues?.providerCuit, fetchLastCategory, fetchProviderName]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        deductionCategory: data.deductionCategory,
        providerCuit: data.providerCuit.replace(/-/g, ""),
        providerName: data.providerName,
        invoiceType: data.invoiceType,
        invoiceNumber: data.invoiceNumber || undefined,
        invoiceDate: data.invoiceDate || undefined,
        amount: parseFloat(data.amount),
        fiscalYear: parseInt(data.fiscalYear),
        fiscalMonth: parseInt(data.fiscalMonth),
        description: data.description,
        contractStartDate: data.contractStartDate || undefined,
        contractEndDate: data.contractEndDate || undefined,
        familyDependentId:
          data.deductionCategory === "GASTOS_EDUCATIVOS" && familyDependentId
            ? familyDependentId
            : null,
      };

      const res = await fetch(invoiceId ? `/api/facturas/${invoiceId}` : "/api/facturas", {
        method: invoiceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          invoiceId
            ? payload
            : {
                ...payload,
                ...(fileData?.fileBase64
                  ? {
                      fileBase64: fileData.fileBase64,
                      fileMimeType: fileData.fileMimeType,
                      originalFilename: fileData.originalFilename,
                    }
                  : {}),
              },
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
        return;
      }

      toast.success(invoiceId ? "Comprobante actualizado" : "Comprobante cargado correctamente");
      if (onSaved) {
        onSaved();
      } else {
        router.push("/facturas");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCuitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCuit(e.target.value);
    form.setValue("providerCuit", formatted, { shouldValidate: true });
    fetchLastCategory(formatted);
    fetchProviderName(formatted);
  }

  const fromFile = !!fileData;
  const watchedCategory = form.watch("deductionCategory");
  const watchedCuit = form.watch("providerCuit");
  const watchedProviderName = form.watch("providerName");
  const watchedInvoiceType = form.watch("invoiceType");
  const watchedAmount = form.watch("amount");
  const watchedInvoiceNumber = form.watch("invoiceNumber");
  const watchedInvoiceDate = form.watch("invoiceDate");
  const watchedContractStartDate = form.watch("contractStartDate");
  const watchedContractEndDate = form.watch("contractEndDate");

  function missingGlow(value: string | undefined) {
    return fromFile && !value ? "border-amber-300 bg-amber-50/50" : "";
  }

  const formContent = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Categoria SiRADIG</Label>
        <div className="relative">
          {classifying && (
            <div className="ai-shimmer-border pointer-events-none absolute -inset-[2px] rounded-[calc(var(--radius-md)+2px)] p-[2px]">
              <div className="bg-background h-full w-full rounded-md" />
            </div>
          )}
          <Select
            value={watchedCategory}
            onValueChange={(v) => form.setValue("deductionCategory", v, { shouldValidate: true })}
            disabled={classifying}
          >
            <SelectTrigger
              className={cn(
                "relative z-10 w-full overflow-hidden [&>span]:truncate",
                missingGlow(watchedCategory),
              )}
            >
              {classifying ? (
                <span className="text-muted-foreground flex items-center gap-2">
                  <Sparkles className="text-primary h-4 w-4 animate-pulse" />
                  Clasificando con IA...
                </span>
              ) : (
                <SelectValue placeholder="Seleccionar categoria" />
              )}
            </SelectTrigger>
            <SelectContent>
              {DEDUCTION_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {DEDUCTION_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.formState.errors.deductionCategory && (
          <p className="text-destructive text-sm">
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
            className={missingGlow(watchedCuit)}
            {...form.register("providerCuit")}
            onChange={handleCuitChange}
          />
          {form.formState.errors.providerCuit && (
            <p className="text-destructive text-sm">{form.formState.errors.providerCuit.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="providerName">Nombre del proveedor</Label>
          <div className="relative">
            <Input
              id="providerName"
              placeholder={lookingUpName ? "Buscando..." : "Se completa con el CUIT"}
              className={cn(missingGlow(watchedProviderName), "read-only:bg-muted/30")}
              readOnly
              {...form.register("providerName")}
            />
            {lookingUpName && (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            )}
          </div>
          {form.formState.errors.providerName && (
            <p className="text-destructive text-sm">{form.formState.errors.providerName.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de comprobante</Label>
          <Select
            value={watchedInvoiceType}
            onValueChange={(v) => form.setValue("invoiceType", v, { shouldValidate: true })}
          >
            <SelectTrigger className={missingGlow(watchedInvoiceType)}>
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
            <p className="text-destructive text-sm">{form.formState.errors.invoiceType.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto ($)</Label>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="200.000,50"
            className={missingGlow(watchedAmount)}
            value={formatArgNumber(watchedAmount)}
            onChange={(e) => {
              const raw = unformatArgNumber(e.target.value);
              form.setValue("amount", raw, { shouldValidate: true });
            }}
          />
          {form.formState.errors.amount && (
            <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">Numero de comprobante</Label>
          <Input
            id="invoiceNumber"
            placeholder="00001-00012345"
            className={missingGlow(watchedInvoiceNumber)}
            {...form.register("invoiceNumber")}
          />
          {form.formState.errors.invoiceNumber && (
            <p className="text-destructive text-sm">
              {form.formState.errors.invoiceNumber.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoiceDate">Fecha del comprobante</Label>
          <Input
            id="invoiceDate"
            type="date"
            className={missingGlow(watchedInvoiceDate)}
            {...form.register("invoiceDate")}
          />
          {form.formState.errors.invoiceDate && (
            <p className="text-destructive text-sm">{form.formState.errors.invoiceDate.message}</p>
          )}
        </div>
      </div>

      {watchedCategory === "ALQUILER_VIVIENDA" && (
        <div className="space-y-2">
          <Label>Vigencia del contrato</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground/60 text-xs">Desde</p>
              <Input
                id="contractStartDate"
                type="date"
                className={missingGlow(watchedContractStartDate)}
                {...form.register("contractStartDate")}
              />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground/60 text-xs">Hasta</p>
              <Input
                id="contractEndDate"
                type="date"
                className={missingGlow(watchedContractEndDate)}
                {...form.register("contractEndDate")}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Año fiscal</Label>
          {lockedYear !== null ? (
            <div className="border-border bg-muted/30 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm">
              {lockedYear}
            </div>
          ) : (
            <Select
              value={form.watch("fiscalYear")}
              onValueChange={(v) => form.setValue("fiscalYear", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Mes</Label>
          <Select
            value={form.watch("fiscalMonth")}
            onValueChange={(v) => form.setValue("fiscalMonth", v, { shouldValidate: true })}
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

      {watchedCategory === "GASTOS_EDUCATIVOS" && (
        <div className="space-y-2">
          <Label>Familiar vinculado</Label>
          <Select
            value={familyDependentId}
            onValueChange={(v) => setFamilyDependentId(v === "_none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin vincular" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sin vincular</SelectItem>
              {dependents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.apellido} {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Selecciona el familiar al que corresponde este gasto educativo
          </p>
        </div>
      )}

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
          {invoiceId ? "Guardar cambios" : "Guardar comprobante"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push("/facturas"))}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );

  if (onSaved) {
    return formContent;
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Datos del comprobante</CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
