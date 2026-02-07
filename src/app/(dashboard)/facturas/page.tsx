import { InvoiceList } from "@/components/facturas/invoice-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

export default function FacturasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Facturas</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus comprobantes para cargar en SiRADIG
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/facturas/subir">
              <Upload className="mr-2 h-4 w-4" />
              Subir PDF
            </Link>
          </Button>
          <Button asChild>
            <Link href="/facturas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Carga manual
            </Link>
          </Button>
        </div>
      </div>
      <InvoiceList />
    </div>
  );
}
