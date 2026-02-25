"use client";

import { useState } from "react";
import { FileUploader } from "@/components/facturas/file-uploader";
import { InvoiceList } from "@/components/facturas/invoice-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function FacturasPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus comprobantes para cargar en SiRADIG
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/facturas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Carga manual
          </Link>
        </Button>
      </div>

      <FileUploader onInvoiceSaved={() => setRefreshKey((k) => k + 1)} />

      <InvoiceList key={refreshKey} />
    </div>
  );
}
