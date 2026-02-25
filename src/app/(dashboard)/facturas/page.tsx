"use client";

import { useState } from "react";
import { Upload, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileUploader } from "@/components/facturas/file-uploader";
import { InvoiceForm } from "@/components/facturas/invoice-form";
import { InvoiceList } from "@/components/facturas/invoice-list";

export default function FacturasPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  function handleSaved() {
    setUploadOpen(false);
    setManualOpen(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Comprobantes para deducciones SiRADIG
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <PenLine className="mr-2 h-4 w-4" />
            Carga manual
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir archivo
          </Button>
        </div>
      </div>

      <InvoiceList key={refreshKey} />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subir comprobante</DialogTitle>
            <DialogDescription>
              Subi un archivo PDF, JPG, PNG o WebP y extraeremos los datos
              automaticamente.
            </DialogDescription>
          </DialogHeader>
          <FileUploader onInvoiceSaved={handleSaved} />
        </DialogContent>
      </Dialog>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carga manual</DialogTitle>
            <DialogDescription>
              Ingresa los datos del comprobante manualmente.
            </DialogDescription>
          </DialogHeader>
          <InvoiceForm
            onSaved={handleSaved}
            onCancel={() => setManualOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
