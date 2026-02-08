"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FileUploadStatus = "pending" | "uploading" | "success" | "error";

export interface FileUploadEntry {
  id: string;
  file: File;
  status: FileUploadStatus;
  extractedAmount?: number | null;
  extractedProvider?: string | null;
  error?: string;
}

interface PdfUploadDropzoneProps {
  entries: FileUploadEntry[];
  isUploading: boolean;
  progress: number;
  onFilesSelected: (files: File[]) => void;
  onRemoveEntry: (id: string) => void;
  onClearAll: () => void;
}

export function PdfUploadDropzone({
  entries,
  isUploading,
  progress,
  onFilesSelected,
  onRemoveEntry,
  onClearAll,
}: PdfUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFilesSelected(files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFilesSelected]
  );

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          Arrastra facturas aqui o hace click para seleccionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, JPG, PNG o WebP. Maximo 10MB por archivo.
        </p>
      </div>

      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Procesando facturas...</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress value={progress * 100} />
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {entries.length} archivo(s)
            </span>
            {!isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-6 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
            >
              {entry.status === "pending" && (
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {entry.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              {entry.status === "success" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
              {entry.status === "error" && (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}

              <span className="truncate flex-1">{entry.file.name}</span>

              {entry.status === "success" && entry.extractedAmount != null && (
                <Badge variant="secondary" className="shrink-0">
                  ${entry.extractedAmount.toLocaleString("es-AR")}
                </Badge>
              )}

              {entry.status === "error" && (
                <span className="text-xs text-destructive truncate">
                  {entry.error}
                </span>
              )}

              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveEntry(entry.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
