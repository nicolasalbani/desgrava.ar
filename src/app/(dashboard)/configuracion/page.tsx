"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmailIngestCard } from "@/components/configuracion/email-ingest-card";

interface Preference {
  defaultFiscalYear: number;
  notifications: boolean;
}

export default function ConfiguracionPage() {
  const [preference, setPreference] = useState<Preference>({
    defaultFiscalYear: new Date().getFullYear(),
    notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => setPreference(data.preference))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preference),
      });
      if (!res.ok) throw new Error();
      toast.success("Configuracion guardada");
    } catch {
      toast.error("Error al guardar la configuracion");
    } finally {
      setSaving(false);
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
            <Label htmlFor="notifications">Notificaciones</Label>
            <p className="text-xs text-muted-foreground/60">
              Recibir notificaciones sobre el estado de las cargas
            </p>
          </div>
          <Switch
            id="notifications"
            checked={preference.notifications}
            onCheckedChange={(checked) =>
              setPreference((prev) => ({ ...prev, notifications: checked }))
            }
          />
        </div>

        <div className="border-t border-gray-200" />

        <div className="space-y-2">
          <Label htmlFor="fiscalYear">Periodo fiscal por defecto</Label>
          <p className="text-xs text-muted-foreground/60">
            Ano fiscal que se usara al cargar nuevas deducciones
          </p>
          <Input
            id="fiscalYear"
            type="number"
            value={preference.defaultFiscalYear}
            onChange={(e) =>
              setPreference((prev) => ({
                ...prev,
                defaultFiscalYear:
                  parseInt(e.target.value) || new Date().getFullYear(),
              }))
            }
            className="w-32"
          />
        </div>

        <div className="pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>

        <div className="border-t border-gray-200" />

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
