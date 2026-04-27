"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spotlight } from "@/components/onboarding/spotlight";

/**
 * One-shot spotlight that highlights the upload action row on /facturas
 * when the user arrives via `?spotlight=upload` (e.g. from the dashboard's
 * "Cargar factura" button).
 */
export function UploadSpotlight() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shown, setShown] = useState(searchParams.get("spotlight") === "upload");

  function dismiss() {
    setShown(false);
    // Clean the URL so a refresh doesn't re-trigger.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("spotlight");
    const qs = params.toString();
    router.replace(qs ? `/facturas?${qs}` : "/facturas");
  }

  if (!shown) return null;

  return (
    <Spotlight
      selector='[data-tour="facturas-actions"]'
      title="Cargá tus comprobantes"
      body="Subí archivos, hacé carga manual, importalos desde ARCA o reenvialos por email. Todo desde acá."
      stepIndex={0}
      totalSteps={1}
      onNext={dismiss}
      onSkip={dismiss}
      isLast={true}
    />
  );
}
