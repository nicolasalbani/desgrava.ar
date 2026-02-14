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
  isEmpty,
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
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg px-4 py-6 text-center transition-all duration-150 min-h-[100px]",
          isUploading
            ? "border-gray-300 cursor-default"
            : "cursor-pointer hover:border-blue-400 hover:bg-blue-50",
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300"
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
            <Loader2 className="h-6 w-6 mx-auto mb-1.5 text-gray-400 animate-spin" />
            <p className="text-sm font-medium">Procesando facturas...</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto mb-1.5 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">
              Arrastra facturas aqui o hace click para seleccionar
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, JPG, PNG o WebP. Maximo 10MB por archivo.
            </p>
            {isEmpty && (
              <p className="text-xs text-gray-400 mt-1">
                No hay deducciones agregadas. Subi facturas o usa &quot;Agregar&quot;.
              </p>
            )}
          </>
        )}
      </div>

      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress value={progress * 100} />
        </div>
      )}
    </div>
  );
}
