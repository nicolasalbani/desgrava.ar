"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useJobStatus } from "@/hooks/use-job-status";
import { enqueueAutomationJob } from "@/hooks/use-arca-import-progress";

export function SubmitPresentacionDialog({
  open,
  onOpenChange,
  onSubmitComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitComplete: () => void;
}) {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? new Date().getFullYear();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const skippedBoolRef = useRef(false);
  const skippedRef = useRef<string[]>([]);
  const [skipPrefLoaded, setSkipPrefLoaded] = useState(false);
  const autoStartedRef = useRef(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Track the in-flight job so we can refresh the list + toast on completion
  // even after the dialog has already closed. The component itself stays
  // mounted (the parent always renders <SubmitPresentacionDialog />),
  // so this hook keeps polling regardless of dialog visibility.
  useJobStatus(activeJobId, {
    onTerminal: ({ status: finalStatus, errorMessage: finalError }) => {
      setActiveJobId(null);
      if (finalStatus === "COMPLETED") {
        toast.success("Presentacion enviada al empleador");
        onSubmitComplete();
      } else {
        toast.error(finalError ?? "Error al enviar presentacion");
      }
    },
  });

  // Fetch skip preference on mount
  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const arr: string[] = data.preference?.skippedArcaDialogs ?? [];
        skippedRef.current = arr;
        const isSkipped = arr.includes("submit-presentacion");
        skippedBoolRef.current = isSkipped;
        setSkipped(isSkipped);
        setSkipPrefLoaded(true);
      })
      .catch(() => setSkipPrefLoaded(true));
  }, []);

  // Reset auto-start guard whenever the dialog reopens
  useEffect(() => {
    if (open) autoStartedRef.current = false;
  }, [open]);

  async function saveSkipPreference(checked: boolean) {
    setSkipped(checked);
    const key = "submit-presentacion";
    const updated = checked
      ? [...skippedRef.current.filter((k) => k !== key), key]
      : skippedRef.current.filter((k) => k !== key);
    skippedRef.current = updated;
    try {
      await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skippedArcaDialogs: updated }),
      });
    } catch {
      // Silently fail — preference is non-critical
    }
  }

  const handleStart = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const res = await enqueueAutomationJob(
        "/api/presentaciones/enviar",
        { fiscalYear: year },
        { jobType: "SUBMIT_PRESENTACION", fiscalYear: year },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar envio");
      }

      const { job } = await res.json();
      setActiveJobId(job.id);
      // Strip drives the rest of the feedback — close the dialog so it doesn't
      // block the screen.
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setIsSubmitting(false);
    }
  }, [year, onOpenChange]);

  // Auto-start when skip preference is enabled — bypass the dialog entirely.
  useEffect(() => {
    if (open && skipPrefLoaded && skippedBoolRef.current && !autoStartedRef.current) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [open, skipPrefLoaded, handleStart]);

  // When the parent says open=true but the user has chosen to skip this
  // dialog, we override Radix's open to false so the modal frame never
  // appears — the auto-start effect above fires the job in the background
  // and the strip drives feedback. The same effect path also closes the
  // dialog after a manual click via onOpenChange(false).
  const visiblyOpen = open && !(skipPrefLoaded && skippedBoolRef.current);

  return (
    <Dialog open={visiblyOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear nueva presentacion</DialogTitle>
          <DialogDescription>
            Se generara el formulario F.572 Web con todas las deducciones cargadas y se enviara al
            empleador via SiRADIG.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-muted/40 rounded-xl p-4 text-sm">
            <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
            <ul className="text-muted-foreground space-y-1.5 text-xs">
              <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
              <li>2. Ir a SiRADIG → Carga de Formulario → Vista Previa</li>
              <li>3. Descargar el borrador del formulario en PDF</li>
              <li>4. Enviar la presentación al empleador (&quot;Generar Presentación&quot;)</li>
            </ul>
            <p className="text-muted-foreground/70 mt-3 text-xs">
              Se generará una nueva presentación para el periodo {year}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="skip-submit"
              checked={skipped}
              onCheckedChange={(checked) => saveSkipPreference(checked === true)}
            />
            <label htmlFor="skip-submit" className="text-muted-foreground cursor-pointer text-xs">
              No volver a mostrar este mensaje
            </label>
          </div>
          <Button onClick={handleStart} disabled={isSubmitting} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            Enviar presentacion
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
