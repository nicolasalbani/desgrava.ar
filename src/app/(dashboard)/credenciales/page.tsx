"use client";

import { CredentialsForm } from "@/components/credenciales/credentials-form";

export default function CredencialesPage() {
  return (
    <div className="space-y-10 max-w-xl">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Credenciales ARCA
        </h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Tu CUIT y clave fiscal para automatizar la carga en SiRADIG
        </p>
      </div>

      <div
        className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <CredentialsForm />
      </div>
    </div>
  );
}
