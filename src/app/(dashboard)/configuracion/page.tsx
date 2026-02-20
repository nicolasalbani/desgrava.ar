"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
    return <div className="text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground mt-1">
          Ajusta tus preferencias para la carga de deducciones
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
          <CardDescription>
            Configura el comportamiento de la automatizacion y notificaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Notificaciones</Label>
              <p className="text-sm text-muted-foreground">
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

          <div className="space-y-2">
            <Label htmlFor="fiscalYear">Periodo fiscal por defecto</Label>
            <Input
              id="fiscalYear"
              type="number"
              value={preference.defaultFiscalYear}
              onChange={(e) =>
                setPreference((prev) => ({
                  ...prev,
                  defaultFiscalYear: parseInt(e.target.value) || new Date().getFullYear(),
                }))
              }
              className="w-32"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
