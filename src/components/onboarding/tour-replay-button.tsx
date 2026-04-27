"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";

export function TourReplayButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/tour/replay", { method: "POST" });
      if (!res.ok) throw new Error();
      // Hard reload — router.refresh() does not reliably re-evaluate the
      // (dashboard) layout's tourSeenAt read in Next.js 16, so the tour would
      // not mount until the user manually reloaded.
      window.location.href = "/dashboard?replay=1";
    } catch {
      toast.error("No se pudo iniciar el tour");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Volver a ver el tour"
      className="bg-card border-border text-muted-foreground hover:text-foreground fixed bottom-4 left-4 z-30 flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-2 text-xs shadow-md transition-colors disabled:opacity-60"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Volver a ver el tour</span>
    </button>
  );
}
