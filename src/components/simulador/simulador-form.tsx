"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Plus, Trash2, Loader2, FileText } from "lucide-react";
import { CATEGORY_LABELS, type SimuladorCategory } from "@/lib/simulador/deduction-rules";
import { SimuladorResults } from "./simulador-results";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import type { SimulationResult } from "@/lib/simulador/calculator";

const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_UPLOAD_FILES = 10;

const formSchema = z.object({
  salarioBrutoMensual: z.string().min(1, "El salario es requerido").refine(
    (val) => {
      const num = parseFloat(unformatArgNumber(val));
      return !isNaN(num) && num > 0;
    },
    { message: "El salario debe ser mayor a 0" }
  ),
  tieneHijos: z.string(),
  tieneConyuge: z.boolean(),
  incluyeSindicato: z.boolean(),
  deducciones: z
    .array(
      z.object({
        category: z.string().min(1, "Selecciona una categoria"),
        monthlyAmount: z.string().min(1, "Ingresa un monto").refine(
          (val) => {
            const num = parseFloat(unformatArgNumber(val));
            return !isNaN(num) && num > 0;
          },
          { message: "El monto debe ser mayor a 0" }
        ),
        _sourceFilename: z.string().optional(),
      })
    ),
});

type FormData = z.infer<typeof formSchema>;

const categories = Object.entries(CATEGORY_LABELS) as [SimuladorCategory, string][];

function formatArgNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}

function unformatArgNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function SimuladorForm() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      salarioBrutoMensual: "",
      tieneHijos: "0",
      tieneConyuge: false,
      incluyeSindicato: false,
      deducciones: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "deducciones",
  });

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const validFiles = files
      .filter((f) => ALLOWED_UPLOAD_TYPES.includes(f.type))
      .slice(0, MAX_UPLOAD_FILES);

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/simulador/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const amount = data.extractedFields?.amount ?? null;
          append({
            category: "",
            monthlyAmount: amount != null ? amount.toString() : "",
            _sourceFilename: file.name,
          });
        }
      } catch {
        // skip failed files silently
      }
      setUploadProgress((i + 1) / validFiles.length);
    }

    setIsUploading(false);
  }, [append]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/simulador/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salarioBrutoMensual: parseFloat(unformatArgNumber(data.salarioBrutoMensual)),
          tieneHijos: parseInt(data.tieneHijos),
          tieneConyuge: data.tieneConyuge,
          incluyeSindicato: data.incluyeSindicato,
          deducciones: data.deducciones.map((d) => ({
            category: d.category,
            monthlyAmount: parseFloat(unformatArgNumber(d.monthlyAmount)),
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error(err);
        return;
      }

      const simResult = await res.json();
      setResult(simResult);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-12">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

        {/* Salary */}
        <div className="space-y-2">
          <Label htmlFor="salario" className="text-sm text-muted-foreground">
            Salario bruto mensual
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-lg select-none">$</span>
            <Input
              id="salario"
              type="text"
              inputMode="numeric"
              placeholder="2.000.000"
              value={formatArgNumber(form.watch("salarioBrutoMensual"))}
              onChange={(e) => {
                const raw = unformatArgNumber(e.target.value);
                form.setValue("salarioBrutoMensual", raw, { shouldValidate: true });
              }}
              className="pl-8 h-14 text-xl font-medium tracking-tight"
            />
          </div>
          {form.formState.errors.salarioBrutoMensual && (
            <p className="text-sm text-destructive">
              {form.formState.errors.salarioBrutoMensual.message}
            </p>
          )}
        </div>

        {/* Family situation */}
        <div className="flex flex-wrap gap-x-8 gap-y-4 py-5 border-y border-border">
          <div className="space-y-1">
            <Label htmlFor="hijos" className="text-sm text-muted-foreground">Hijos a cargo</Label>
            <Input
              id="hijos"
              type="number"
              min="0"
              max="20"
              {...form.register("tieneHijos")}
              className="w-24 h-9"
            />
          </div>

          <div className="flex items-center gap-3 self-end pb-0.5">
            <Switch
              id="conyuge"
              checked={form.watch("tieneConyuge")}
              onCheckedChange={(v) => form.setValue("tieneConyuge", v)}
            />
            <Label htmlFor="conyuge" className="cursor-pointer text-sm">Conyuge a cargo</Label>
          </div>

          <div className="flex items-center gap-3 self-end pb-0.5">
            <Switch
              id="sindicato"
              checked={form.watch("incluyeSindicato")}
              onCheckedChange={(v) => form.setValue("incluyeSindicato", v)}
            />
            <Label htmlFor="sindicato" className="cursor-pointer text-sm">Aporte sindical (2%)</Label>
          </div>
        </div>

        {/* Deductions */}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Deducciones por comprobantes</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Subi facturas para cargarlas automaticamente, o agrega manualmente
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => append({ category: "", monthlyAmount: "" })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar
            </Button>
          </div>

          <PdfUploadDropzone
            isUploading={isUploading}
            progress={uploadProgress}
            onFilesSelected={handleFilesSelected}
            isEmpty={fields.length === 0}
          />

          {fields.length > 0 && (
            <div className="space-y-3 pt-1">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
                >
                  <div className="flex-1 min-w-0 space-y-1 w-full">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                    )}
                    <Select
                      value={form.watch(`deducciones.${index}.category`)}
                      onValueChange={(v) =>
                        form.setValue(`deducciones.${index}.category`, v)
                      }
                    >
                      <SelectTrigger className="w-full overflow-hidden">
                        <SelectValue placeholder="Seleccionar categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-44 sm:shrink-0 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Monto mensual</Label>
                    )}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm select-none">$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="200.000"
                        value={formatArgNumber(form.watch(`deducciones.${index}.monthlyAmount`))}
                        onChange={(e) => {
                          const raw = unformatArgNumber(e.target.value);
                          form.setValue(`deducciones.${index}.monthlyAmount`, raw, { shouldValidate: true });
                        }}
                        className="pl-6"
                      />
                    </div>
                  </div>

                  {form.watch(`deducciones.${index}._sourceFilename`) && (
                    <div className="shrink-0 text-xs text-muted-foreground max-w-32 truncate hidden sm:flex items-center gap-1 pb-2">
                      <FileText className="h-3 w-3 shrink-0" />
                      {form.watch(`deducciones.${index}._sourceFilename`)}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="shrink-0 text-muted-foreground/60 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {form.formState.errors.deducciones && (
                <p className="text-sm text-destructive">
                  Completa todos los campos de las deducciones
                </p>
              )}
            </div>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-4 w-4" />
          )}
          Calcular ahorro
        </Button>
      </form>

      {result && <SimuladorResults result={result} />}
    </div>
  );
}
