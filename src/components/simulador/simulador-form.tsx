"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    )
    ,
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

  // PDF upload state
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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calculator className="h-6 w-6" />
            <div>
              <CardTitle>Datos de tu sueldo</CardTitle>
              <CardDescription>
                Ingresa tu salario bruto mensual y tu situacion familiar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salario">Salario bruto mensual ($)</Label>
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
                />
                {form.formState.errors.salarioBrutoMensual && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.salarioBrutoMensual.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hijos">Hijos a cargo</Label>
                <Input
                  id="hijos"
                  type="number"
                  min="0"
                  max="20"
                  {...form.register("tieneHijos")}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="conyuge"
                  checked={form.watch("tieneConyuge")}
                  onCheckedChange={(v) => form.setValue("tieneConyuge", v)}
                />
                <Label htmlFor="conyuge">Conyuge a cargo</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="sindicato"
                  checked={form.watch("incluyeSindicato")}
                  onCheckedChange={(v) => form.setValue("incluyeSindicato", v)}
                />
                <Label htmlFor="sindicato">Aporte sindical (2%)</Label>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Deducciones por comprobantes</h3>
                  <p className="text-sm text-muted-foreground">
                    Subi tus facturas para cargar automaticamente o agrega deducciones manualmente
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ category: "", monthlyAmount: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>

              <div className="mb-4">
                <PdfUploadDropzone
                  isUploading={isUploading}
                  progress={uploadProgress}
                  onFilesSelected={handleFilesSelected}
                />
              </div>

              {fields.length === 0 && !isUploading && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                  No hay deducciones agregadas. Subi facturas o hace click en &quot;Agregar&quot; para
                  sumar una deduccion.
                </p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
                  >
                    <div className="flex-1 space-y-1 w-full">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Categoria
                        </Label>
                      )}
                      <Select
                        value={form.watch(`deducciones.${index}.category`)}
                        onValueChange={(v) =>
                          form.setValue(`deducciones.${index}.category`, v)
                        }
                      >
                        <SelectTrigger>
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

                    <div className="w-full sm:w-48 space-y-1">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Monto mensual ($)
                        </Label>
                      )}
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="200.000"
                        value={formatArgNumber(form.watch(`deducciones.${index}.monthlyAmount`))}
                        onChange={(e) => {
                          const raw = unformatArgNumber(e.target.value);
                          form.setValue(`deducciones.${index}.monthlyAmount`, raw, { shouldValidate: true });
                        }}
                      />
                    </div>

                    {form.watch(`deducciones.${index}._sourceFilename`) && (
                      <Badge variant="outline" className="shrink-0 text-xs max-w-32 truncate hidden sm:flex">
                        <FileText className="h-3 w-3 mr-1 shrink-0" />
                        {form.watch(`deducciones.${index}._sourceFilename`)}
                      </Badge>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {fields.length > 0 &&
                form.formState.errors.deducciones && (
                  <p className="text-sm text-destructive mt-2">
                    Completa todos los campos de las deducciones
                  </p>
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
        </CardContent>
      </Card>

      {result && <SimuladorResults result={result} />}
    </div>
  );
}
