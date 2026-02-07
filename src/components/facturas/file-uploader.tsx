"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { InvoiceForm } from "./invoice-form";
import { formatCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";

interface ExtractedFields {
  cuit: string | null;
  invoiceType: string | null;
  amount: number | null;
  date: string | null;
  providerName: string | null;
  confidence: number;
}

export function FileUploader() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [filename, setFilename] = useState("");
  const [method, setMethod] = useState("");

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

  const confidencePercent = extracted ? Math.round(extracted.confidence * 100) : 0;

  // Build default values for the form from extracted fields
  const defaultValues = extracted
    ? {
        providerCuit: extracted.cuit ? formatCuit(extracted.cuit) : "",
        providerName: extracted.providerName ?? "",
        invoiceType: extracted.invoiceType ?? "",
        amount: extracted.amount ?? undefined,
        fiscalYear: extracted.date
          ? parseInt(extracted.date.split("-")[0])
          : new Date().getFullYear(),
        fiscalMonth: extracted.date
          ? parseInt(extracted.date.split("-")[1])
          : new Date().getMonth() + 1,
      }
    : undefined;

  return (
    <div className="space-y-6">
      {!extracted && (
        <Card>
          <CardHeader>
            <CardTitle>Subir comprobante</CardTitle>
            <CardDescription>
              Arrastra un archivo o hace click para seleccionar. Soporta PDF, JPG, PNG.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Procesando {filename}...
                  </p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      Arrastra tu factura aca o hace click para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, JPG, PNG o WebP. Maximo 10MB.
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
          </CardContent>
        </Card>
      )}

      {extracted && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">Datos extraidos</CardTitle>
                    <CardDescription>{filename}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">{method}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {confidencePercent >= 75 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Confianza de extraccion</span>
                    <span className="font-medium">{confidencePercent}%</span>
                  </div>
                  <Progress value={confidencePercent} />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Revisa y completa los datos antes de guardar. Los campos extraidos
                se pre-cargaron en el formulario.
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExtracted(null);
                  setFilename("");
                }}
              >
                Subir otro archivo
              </Button>
            </CardContent>
          </Card>

          <InvoiceForm defaultValues={defaultValues} />
        </div>
      )}
    </div>
  );
}
