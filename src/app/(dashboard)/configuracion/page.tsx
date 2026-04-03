"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmailIngestCard } from "@/components/configuracion/email-ingest-card";
import { AutoSubmitCard } from "@/components/configuracion/auto-submit-card";
import { SubscriptionCard } from "@/components/subscription/subscription-card";

export default function ConfiguracionPage() {
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => setNotifications(data.preference?.notifications ?? true))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(checked: boolean) {
    setNotifications(checked);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: checked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(!checked);
      toast.error("Error al guardar la configuracion");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-10">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground/70 mt-1 text-sm">
          Preferencias para la carga de deducciones
        </p>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <div className="space-y-2">
          <Label>Suscripción</Label>
          <p className="text-muted-foreground/60 text-xs">Administrá tu plan y método de pago</p>
        </div>

        <SubscriptionCard />

        <div className="border-border border-t" />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Notificaciones</Label>
            <p className="text-muted-foreground/60 text-xs">
              Recibir notificaciones sobre el estado de las cargas
            </p>
          </div>
          <Switch id="notifications" checked={notifications} onCheckedChange={handleToggle} />
        </div>

        <div className="border-border border-t" />

        <div className="space-y-2">
          <Label>Email para comprobantes</Label>
          <p className="text-muted-foreground/60 text-xs">
            Envia comprobantes por email y se cargan automaticamente
          </p>
        </div>

        <EmailIngestCard />

        <div className="border-border border-t" />

        <AutoSubmitCard />
      </div>
    </div>
  );
}
