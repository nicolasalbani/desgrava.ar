"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PdfUploadDropzoneProps {
  isUploading: boolean;
  progress: number;
  onFilesSelected: (files: File[]) => void;
  isEmpty?: boolean;
}

export function PdfUploadDropzone({
  isUploading,
  progress,
  onFilesSelected,
  isEmpty: _isEmpty,
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
    [onFilesSelected],
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
    [onFilesSelected],
  );

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200",
          isUploading
            ? "border-border cursor-default"
            : "cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
          isDragOver ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "border-border",
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
        {isUploading ? (
          <>
            <Loader2 className="text-muted-foreground/50 mx-auto mb-2 h-5 w-5 animate-spin" />
            <p className="text-muted-foreground text-sm">Procesando facturas...</p>
          </>
        ) : (
          <>
            <Upload className="text-muted-foreground/40 mx-auto mb-2 h-5 w-5" />
            <p className="text-muted-foreground text-sm">
              Arrastra facturas aqui o hace click para seleccionar
            </p>
            <p className="text-muted-foreground/50 mt-1 text-xs">PDF, JPG o PNG</p>
          </>
        )}
      </div>

      {isUploading && (
        <div className="space-y-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress value={progress * 100} />
        </div>
      )}
    </div>
  );
}
