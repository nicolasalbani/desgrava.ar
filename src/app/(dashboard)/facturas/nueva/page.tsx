import { InvoiceForm } from "@/components/facturas/invoice-form";

export default function NuevaFacturaPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Carga manual de factura</h1>
        <p className="text-muted-foreground mt-1">
          Ingresa los datos del comprobante manualmente
        </p>
      </div>
      <InvoiceForm />
    </div>
  );
}
