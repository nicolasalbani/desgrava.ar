"use client";

import { CredentialsForm } from "@/components/credenciales/credentials-form";

export default function CredencialesPage() {
  return (
    <div className="space-y-10 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Credenciales ARCA
        </h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Tu CUIT y clave fiscal para automatizar la carga en SiRADIG
        </p>
      </div>

      <CredentialsForm />
    </div>
  );
}
