import { FileUploader } from "@/components/facturas/file-uploader";

export default function SubirFacturaPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Subir factura</h1>
        <p className="text-muted-foreground mt-1">
          Subi un PDF o imagen y extraemos los datos automaticamente con OCR
        </p>
      </div>
      <FileUploader />
    </div>
  );
}
