import { CredentialsForm } from "@/components/credenciales/credentials-form";

export default function CredencialesPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Credenciales ARCA</h1>
        <p className="text-muted-foreground mt-1">
          Guarda tu CUIT y clave fiscal para automatizar la carga en SiRADIG
        </p>
      </div>
      <CredentialsForm />
    </div>
  );
}
