"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { InvoiceForm } from "./invoice-form";
import { formatCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";

interface ExtractedFields {
  cuit: string | null;
  invoiceType: string | null;
  invoiceNumber: string | null;
  amount: number | null;
  date: string | null;
  providerName: string | null;
  confidence: number;
}

export function FileUploader({
  onInvoiceSaved,
}: {
  onInvoiceSaved?: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [filename, setFilename] = useState("");
  const [method, setMethod] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [fileMimeType, setFileMimeType] = useState("");
  const [rawText, setRawText] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setExtracted(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      setFilename(file.name);

      const res = await fetch("/api/facturas/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al procesar");
        return;
      }

      const data = await res.json();
      setExtracted(data.extractedFields);
      setMethod(data.method);
      setFileBase64(data.fileBase64);
      setFileMimeType(data.mimeType);
      setRawText(data.rawText ?? "");
      toast.success("Archivo procesado correctamente");
    } catch {
      toast.error("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setExtracted(null);
    setFilename("");
    setFileBase64("");
    setFileMimeType("");
    setRawText("");
    setMethod("");
  }

  function handleSaved() {
    reset();
    onInvoiceSaved?.();
  }

  const confidencePercent = extracted
    ? Math.round(extracted.confidence * 100)
    : 0;

  const defaultValues = extracted
    ? {
        providerCuit: extracted.cuit ? formatCuit(extracted.cuit) : "",
        providerName: extracted.providerName ?? "",
        invoiceType: extracted.invoiceType ?? "",
        invoiceNumber: extracted.invoiceNumber ?? "",
        invoiceDate: extracted.date ?? "",
        amount: extracted.amount ?? undefined,
        fiscalYear: extracted.date
          ? parseInt(extracted.date.split("-")[0])
          : new Date().getFullYear(),
        fiscalMonth: extracted.date
          ? parseInt(extracted.date.split("-")[1])
          : new Date().getMonth() + 1,
      }
    : undefined;

  // --- Extracted state: show summary banner + form ---
  if (extracted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-2xl bg-muted/50 px-5 py-4">
          <div
            className={`shrink-0 rounded-full p-2 ${
              confidencePercent >= 75
                ? "bg-emerald-500/10"
                : "bg-amber-500/10"
            }`}
          >
            {confidencePercent >= 75 ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium truncate">{filename}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {confidencePercent}% confianza &middot; {method}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancelar
          </Button>
        </div>

        <InvoiceForm
          defaultValues={defaultValues}
          fileData={{ fileBase64, fileMimeType, originalFilename: filename }}
          invoiceRawText={rawText}
          onSaved={handleSaved}
          onCancel={reset}
        />
      </div>
    );
  }

  // --- Default state: drop zone ---
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={`
        relative rounded-2xl border border-dashed
        transition-all duration-300 ease-out
        ${
          uploading
            ? "border-muted-foreground/15 bg-muted/30"
            : dragActive
              ? "border-primary/40 bg-primary/[0.03] shadow-sm"
              : "border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/30 hover:bg-muted/30"
        }
      `}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Procesando{" "}
            <span className="font-medium text-foreground/70">{filename}</span>
          </p>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-3 py-10 cursor-pointer">
          <div className="rounded-full bg-muted/80 p-3">
            <Upload className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/70">
              Arrastra tu factura aca o hace click para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              PDF, JPG, PNG o WebP &mdash; maximo 10MB
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleChange}
          />
        </label>
      )}
    </div>
  );
}
