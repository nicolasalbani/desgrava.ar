"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CredentialsForm } from "@/components/credenciales/credentials-form";

export default function PerfilPage() {
  const { data: session } = useSession();
  const [ownsProperty, setOwnsProperty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => setOwnsProperty(data.preference?.ownsProperty ?? false))
      .finally(() => setLoading(false));
  }, []);

  async function handleOwnsPropertyToggle(checked: boolean) {
    setOwnsProperty(checked);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownsProperty: checked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOwnsProperty(!checked);
      toast.error("Error al guardar la configuracion");
    }
  }

  return (
    <div className="space-y-10 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Tu cuenta y configuracion personal
        </p>
      </div>

      {/* User info */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 ring-2 ring-border">
          <AvatarImage src={session?.user?.image ?? undefined} />
          <AvatarFallback className="text-lg">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{session?.user?.name ?? "—"}</p>
          <p className="text-sm text-muted-foreground/70">
            {session?.user?.email ?? "—"}
          </p>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* ARCA credentials */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Credenciales ARCA</h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Tu CUIT y clave fiscal para automatizar la carga en SiRADIG
          </p>
        </div>
        <CredentialsForm />
      </div>

      <div className="border-t border-border" />

      {/* Preferences */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Preferencias</h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Opciones que afectan el calculo de tus deducciones
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ownsProperty">Soy titular de un inmueble</Label>
              <p className="text-xs text-muted-foreground/60">
                Activar si sos propietario de un inmueble en cualquier proporcion. Determina el beneficio de alquiler aplicable (10% Art. 85 inc. k vs. 40% Art. 85 inc. h).
              </p>
            </div>
            <Switch
              id="ownsProperty"
              checked={ownsProperty}
              onCheckedChange={handleOwnsPropertyToggle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
