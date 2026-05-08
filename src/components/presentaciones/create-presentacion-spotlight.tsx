"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spotlight } from "@/components/onboarding/spotlight";

/**
 * One-shot spotlight that highlights the action row on /presentaciones
 * when the user arrives via `?spotlight=create` (e.g. from the dashboard's
 * "Ir a Presentaciones" button).
 */
export function CreatePresentacionSpotlight() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shown, setShown] = useState(searchParams.get("spotlight") === "create");

  function dismiss() {
    setShown(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("spotlight");
    const qs = params.toString();
    router.replace(qs ? `/presentaciones?${qs}` : "/presentaciones");
  }

  if (!shown) return null;

  return (
    <Spotlight
      selector='[data-tour="presentaciones-actions"]'
      title="Creá tu presentación"
      body="Enviá tus deducciones a SiRADIG para que tu empleador las aplique al cálculo del impuesto."
      stepIndex={0}
      totalSteps={1}
      onNext={dismiss}
      onSkip={dismiss}
      isLast={true}
    />
  );
}
