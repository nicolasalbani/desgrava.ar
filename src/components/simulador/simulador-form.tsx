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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Minus, Trash2, FileText } from "lucide-react";
import { CATEGORY_LABELS, type SimuladorCategory } from "@/lib/simulador/deduction-rules";
import { validateCuit, formatCuit } from "@/lib/validators/cuit";
import { SimuladorResults } from "./simulador-results";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import { simulateSimplified, type SimplifiedSimulationResult } from "@/lib/simulador/calculator";

const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_FILES = 10;

const formSchema = z.object({
  tieneHijos: z.number().int().min(0).max(20),
  tieneConyuge: z.boolean(),
  deducciones: z.array(
    z.object({
      providerName: z.string().optional(),
      cuit: z.string().optional(),
      date: z.string().optional(),
      category: z.string().optional(),
      amount: z.string().optional(),
      _sourceFilename: z.string().optional(),
    }),
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split(/[\/\-.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${c}/${b}/${a}`;
    return `${a}/${b}/${c}`;
  }
  return dateStr;
}

function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Manual entry dialog ─────────────────────────────────────────────────────

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: {
    providerName: string;
    cuit: string;
    date: string;
    category: string;
    amount: string;
  }) => void;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ManualEntryDialog({ open, onOpenChange, onAdd }: ManualEntryDialogProps) {
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [cuitError, setCuitError] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  function reset() {
    setName("");
    setCuit("");
    setCuitError("");
    setDateIso("");
    setCategory("");
    setAmount("");
  }

  function handleCuitChange(value: string) {
    const formatted = formatCuit(value);
    setCuit(formatted);
    const cleaned = formatted.replace(/-/g, "");
    if (cleaned.length === 0) {
      setCuitError("");
    } else if (cleaned.length < 11) {
      setCuitError("El CUIT debe tener 11 digitos");
    } else if (!validateCuit(cleaned)) {
      setCuitError("CUIT invalido");
    } else {
      setCuitError("");
    }
  }

  function handleAdd() {
    if (!category || !amount || !unformatArgNumber(amount)) return;
    if (cuit && cuitError) return;
    onAdd({
      providerName: name,
      cuit: cuit.replace(/-/g, ""),
      date: isoToDisplay(dateIso),
      category,
      amount: unformatArgNumber(amount),
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="overflow-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Agregar deduccion</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Proveedor</Label>
            <Input
              type="text"
              placeholder="Nombre del proveedor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-muted-foreground text-sm">CUIT (opcional)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="20-12345678-9"
                value={cuit}
                onChange={(e) => handleCuitChange(e.target.value)}
                className={cuitError ? "border-destructive" : ""}
              />
              {cuitError && <p className="text-destructive text-xs">{cuitError}</p>}
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Fecha (opcional)</Label>
              <Input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="!w-full min-w-0 overflow-hidden text-left [&>span]:block [&>span]:truncate">
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
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Monto</Label>
            <div className="relative">
              <span className="text-muted-foreground/60 absolute top-1/2 left-3 -translate-y-1/2 text-sm select-none">
                $
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="200.000"
                value={formatArgNumber(amount)}
                onChange={(e) => setAmount(unformatArgNumber(e.target.value))}
                className="pl-7"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!category || !unformatArgNumber(amount) || !!cuitError}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────

export function SimuladorForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tieneHijos: 0,
      tieneConyuge: false,
      deducciones: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "deducciones",
  });

  const tieneHijos = form.watch("tieneHijos");
  const tieneConyuge = form.watch("tieneConyuge");
  const deducciones = form.watch("deducciones");

  // Auto-calculate savings client-side on every render
  // simulateSimplified is pure Decimal.js math — fast enough to skip memoization
  const validDeducciones = deducciones
    .filter((d) => d.category && d.amount && unformatArgNumber(d.amount))
    .map((d) => ({
      category: d.category!,
      amount: parseFloat(unformatArgNumber(d.amount!)),
    }))
    .filter((d) => d.amount > 0);

  const result: SimplifiedSimulationResult | null =
    validDeducciones.length === 0 && !tieneConyuge && tieneHijos === 0
      ? null
      : simulateSimplified({
          tieneHijos,
          tieneConyuge,
          esPropietario: false,
          interesesHipotecariosMensual: 0,
          deducciones: validDeducciones,
        });

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
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
            const fields = data.extractedFields;
            const newCuit = fields?.cuit ?? "";
            const newDate = formatDate(fields?.date) || todayFormatted();
            const newAmount = fields?.amount != null ? Math.round(fields.amount).toString() : "";

            const existing = form.getValues("deducciones");
            const isDuplicate =
              newCuit &&
              newAmount &&
              existing.some(
                (d) =>
                  d.cuit === newCuit &&
                  d.date === newDate &&
                  unformatArgNumber(d.amount ?? "") === newAmount,
              );

            if (!isDuplicate) {
              append({
                providerName: fields?.providerName ?? "",
                cuit: newCuit,
                date: newDate,
                category: data.category ?? "",
                amount: newAmount,
                _sourceFilename: file.name,
              });
            }
          }
        } catch {
          // skip failed files silently
        }
        setUploadProgress((i + 1) / validFiles.length);
      }

      setIsUploading(false);
    },
    [append, form],
  );

  function handleManualAdd(entry: {
    providerName: string;
    cuit: string;
    date: string;
    category: string;
    amount: string;
  }) {
    append({
      providerName: entry.providerName,
      cuit: entry.cuit,
      date: entry.date,
      category: entry.category,
      amount: entry.amount,
    });
  }

  return (
    <div className="space-y-12">
      <div className="space-y-10">
        {/* Family situation + toggles */}
        <div className="border-border flex flex-wrap items-center gap-x-8 gap-y-4 border-b pb-5">
          {/* Hijos stepper */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Hijos a cargo</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={tieneHijos <= 0}
                onClick={() => form.setValue("tieneHijos", Math.max(0, tieneHijos - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-foreground w-8 text-center text-sm font-medium tabular-nums">
                {tieneHijos}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={tieneHijos >= 20}
                onClick={() => form.setValue("tieneHijos", Math.min(20, tieneHijos + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end pb-0.5">
            <Switch
              id="conyuge"
              checked={tieneConyuge}
              onCheckedChange={(v) => form.setValue("tieneConyuge", v)}
            />
            <Label htmlFor="conyuge" className="cursor-pointer text-sm">
              Conyuge a cargo
            </Label>
          </div>
        </div>

        {/* Deductions */}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-foreground text-sm font-medium">Deducciones por comprobantes</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Subi facturas para cargarlas automaticamente, o agrega manualmente
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setManualDialogOpen(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
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
            <TooltipProvider delayDuration={300}>
              <div className="divide-border divide-y pt-1">
                {fields.map((field, index) => {
                  const providerName = form.watch(`deducciones.${index}.providerName`);
                  const cuit = form.watch(`deducciones.${index}.cuit`);
                  const date = form.watch(`deducciones.${index}.date`);
                  const filename = form.watch(`deducciones.${index}._sourceFilename`);

                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_minmax(0,1.2fr)_7rem_auto] items-center gap-2 py-2"
                    >
                      {/* Provider + CUIT + date */}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {providerName || cuit || "Sin proveedor"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {[providerName && cuit ? cuit : null, date].filter(Boolean).join(" · ")}
                        </p>
                      </div>

                      {/* Category */}
                      <Select
                        value={form.watch(`deducciones.${index}.category`) ?? ""}
                        onValueChange={(v) => form.setValue(`deducciones.${index}.category`, v)}
                      >
                        <SelectTrigger className="h-8 w-full overflow-hidden text-xs">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Amount */}
                      <div className="relative">
                        <span className="text-muted-foreground/60 absolute top-1/2 left-2 -translate-y-1/2 text-xs select-none">
                          $
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formatArgNumber(form.watch(`deducciones.${index}.amount`) ?? "")}
                          onChange={(e) => {
                            const raw = unformatArgNumber(e.target.value);
                            form.setValue(`deducciones.${index}.amount`, raw);
                          }}
                          className="h-8 pl-5 text-right text-xs"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5">
                        {filename ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <FileText className="text-muted-foreground/40 h-3.5 w-3.5 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>{filename}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-muted-foreground/40 hover:text-destructive h-7 w-7 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {result && <SimuladorResults result={result} />}

      <ManualEntryDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onAdd={handleManualAdd}
      />
    </div>
  );
}
