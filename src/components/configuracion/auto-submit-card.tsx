"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function AutoSubmitCard() {
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.preference?.autoSubmitEnabled ?? false);
        setDay(data.preference?.autoSubmitDay?.toString() ?? null);
      });
  }, []);

  async function save(newEnabled: boolean, newDay: string | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoSubmitEnabled: newEnabled,
          autoSubmitDay: newDay,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Error al guardar la configuracion");
      // Revert
      setEnabled(!newEnabled);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (checked && !day) {
      // Default to day 1 when enabling
      setDay("1");
      save(checked, "1");
    } else {
      save(checked, day);
    }
  }

  function handleDayChange(value: string) {
    setDay(value);
    save(enabled, value);
  }

  const days = Array.from({ length: 28 }, (_, i) => (i + 1).toString());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-submit">Presentacion automatica a tu empleador</Label>
        </div>
        <Switch
          id="auto-submit"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {enabled && (
        <div className="flex items-center gap-3">
          <Label className="text-muted-foreground text-sm whitespace-nowrap">Dia del mes</Label>
          <Select value={day ?? "1"} onValueChange={handleDayChange} disabled={saving}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
