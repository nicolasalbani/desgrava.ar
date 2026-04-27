"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";

export function AyudaCard() {
  const [replaying, setReplaying] = useState(false);

  async function handleReplay() {
    setReplaying(true);
    try {
      const res = await fetch("/api/tour/replay", { method: "POST" });
      if (!res.ok) throw new Error();
      // Hard reload — router.refresh() does not reliably re-evaluate the
      // (dashboard) layout's tourSeenAt read in Next.js 16, so the tour would
      // not mount until the user manually reloaded.
      window.location.href = "/dashboard?replay=1";
    } catch {
      toast.error("No se pudo iniciar el tour");
      setReplaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          Ayuda
        </Label>
        <p className="text-muted-foreground/60 text-xs">Recorridos guiados y soporte</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-foreground text-sm font-medium">Tour de bienvenida</p>
          <p className="text-muted-foreground/70 text-xs">Volvé a ver la introducción al panel</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReplay} disabled={replaying}>
          {replaying ? "Abriendo…" : "Volver a ver el tour"}
        </Button>
      </div>
    </div>
  );
}
