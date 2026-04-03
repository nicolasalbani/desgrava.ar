"use client";

import { useState, useEffect, useRef } from "react";
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
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { MESES } from "@/lib/validators/domestic";

interface ExtractedReceiptFields {
  workerName: string | null;
  workerCuil: string | null;
  periodo: string | null;
  fiscalYear: number | null;
  fiscalMonth: number | null;
  categoriaProfesional: string | null;
  basico: number | null;
  antiguedad: number | null;
  viaticos: number | null;
  presentismo: number | null;
  otros: number | null;
  total: number | null;
  confidence: number;
}

interface Worker {
  id: string;
  apellidoNombre: string;
  cuil: string;
}

export function ReceiptUploader({ onSaved }: { onSaved: () => void }) {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? new Date().getFullYear();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceiptFields | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [domesticWorkerId, setDomesticWorkerId] = useState("");
  const [fiscalMonth, setFiscalMonth] = useState(new Date().getMonth() + 1);
  const [total, setTotal] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");

  useEffect(() => {
    fetch(`/api/trabajadores?fiscalYear=${year}`)
      .then((r) => r.json())
      .then((d) => setWorkers(d.workers ?? []))
      .catch(() => {});
  }, [year]);

  async function processFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/recibos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al procesar archivo");
      }

      const data = await res.json();
      setExtracted(data.extractedFields);
      setFileBase64(data.fileBase64);
      setFilename(data.filename);
      setMimeType(data.mimeType);

      const fields = data.extractedFields as ExtractedReceiptFields;
      if (fields.total) setTotal(String(fields.total));
      if (fields.fiscalMonth) setFiscalMonth(fields.fiscalMonth);

      if (fields.workerCuil) {
        const match = workers.find(
          (w) => w.cuil === fields.workerCuil || w.cuil.replace(/-/g, "") === fields.workerCuil,
        );
        if (match) setDomesticWorkerId(match.id);
      }

      toast.success("Archivo procesado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function handleSave() {
    if (!total) {
      toast.error("El total es requerido");
      return;
    }

    setSaving(true);
    try {
      const periodo = `${MESES[fiscalMonth - 1]} ${year}`;
      const body = {
        fiscalYear: year,
        fiscalMonth,
        periodo,
        total: parseFloat(total),
        domesticWorkerId: domesticWorkerId || undefined,
        contributionAmount: contributionAmount ? parseFloat(contributionAmount) : undefined,
        categoriaProfesional: extracted?.categoriaProfesional || undefined,
        basico: extracted?.basico || undefined,
        antiguedad: extracted?.antiguedad || undefined,
        viaticos: extracted?.viaticos || undefined,
        presentismo: extracted?.presentismo || undefined,
        otros: extracted?.otros || undefined,
        fileBase64,
        fileMimeType: mimeType,
        originalFilename: filename,
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

      toast.success("Recibo salarial creado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // Step 1: Upload
  if (!extracted) {
    return (
      <div className="space-y-4 p-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          ) : (
            <>
              <Upload className="text-muted-foreground/40 mb-3 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                {dragActive
                  ? "Soltar archivo aqui"
                  : "Arrastra un archivo o hace click para seleccionar"}
              </p>
              <p className="text-muted-foreground/50 mt-1 text-xs">PDF, JPG o PNG (max. 10MB)</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Review and save
  return (
    <div className="space-y-5 p-1">
      <div className="border-border bg-muted/40 flex items-center gap-3 rounded-xl border px-4 py-3">
        <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="text-muted-foreground/60 text-xs">
            Confianza: {Math.round(extracted.confidence * 100)}%
            {extracted.workerName && ` · ${extracted.workerName}`}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Trabajador</Label>
        <Select value={domesticWorkerId} onValueChange={setDomesticWorkerId}>
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
      </div>

      <div className="space-y-1.5">
        <Label>Mes</Label>
        <Select value={String(fiscalMonth)} onValueChange={(v) => setFiscalMonth(Number(v))}>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Total (retribucion)</Label>
          <Input value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>
            Contribucion{" "}
            <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span>
          </Label>
          <Input
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setExtracted(null);
            setFileBase64(null);
          }}
        >
          Volver
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear recibo salarial
        </Button>
      </div>
    </div>
  );
}
