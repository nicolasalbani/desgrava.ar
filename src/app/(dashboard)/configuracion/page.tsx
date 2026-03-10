"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmailIngestCard } from "@/components/configuracion/email-ingest-card";

interface Preference {
  notifications: boolean;
  ownsProperty: boolean;
}

export default function ConfiguracionPage() {
  const [preference, setPreference] = useState<Preference>({
    notifications: true,
    ownsProperty: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) =>
        setPreference({
          notifications: data.preference?.notifications ?? true,
          ownsProperty: data.preference?.ownsProperty ?? false,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(field: keyof Preference, checked: boolean) {
    setPreference((prev) => ({ ...prev, [field]: checked }));
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: checked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPreference((prev) => ({ ...prev, [field]: !checked }));
      toast.error("Error al guardar la configuracion");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuracion
        </h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Preferencias para la carga de deducciones
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ownsProperty">Soy titular de un inmueble</Label>
            <p className="text-xs text-muted-foreground/60">
              Activar si sos propietario de un inmueble en cualquier proporcion. Determina el beneficio de alquiler aplicable (10% Art. 85 inc. k vs. 40% Art. 85 inc. h).
            </p>
          </div>
          <Switch
            id="ownsProperty"
            checked={preference.ownsProperty}
            onCheckedChange={(checked) => handleToggle("ownsProperty", checked)}
          />
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Notificaciones</Label>
            <p className="text-xs text-muted-foreground/60">
              Recibir notificaciones sobre el estado de las cargas
            </p>
          </div>
          <Switch
            id="notifications"
            checked={preference.notifications}
            onCheckedChange={(checked) => handleToggle("notifications", checked)}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <Label>Email para facturas</Label>
          <p className="text-xs text-muted-foreground/60">
            Envia facturas por email y se cargan automaticamente
          </p>
        </div>

        <EmailIngestCard />
      </div>
    </div>
  );
}
