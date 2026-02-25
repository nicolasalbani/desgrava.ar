"use client";

import { useState } from "react";
import { FileUploader } from "@/components/facturas/file-uploader";
import { InvoiceList } from "@/components/facturas/invoice-list";

export default function FacturasPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Comprobantes para deducciones SiRADIG
        </p>
      </div>

      <FileUploader onInvoiceSaved={() => setRefreshKey((k) => k + 1)} />

      <InvoiceList key={refreshKey} />
    </div>
  );
}
