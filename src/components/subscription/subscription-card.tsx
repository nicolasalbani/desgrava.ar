"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS, formatPriceARS, getAnnualTotal } from "@/lib/subscription/plans";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SubscriptionData {
  canWrite: boolean;
  status: string | null;
  plan: string | null;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionCard() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [billingFrequency, setBillingFrequency] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const fetchSubscription = useCallback(() => {
    fetch("/api/subscription")
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast.error("Error al cargar la suscripción"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingFrequency }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      // Redirect to MercadoPago
      window.location.href = body.initPoint;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar el checkout");
      setCheckoutLoading(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success("Suscripción cancelada");
      fetchSubscription();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const plan = SUBSCRIPTION_PLANS.PERSONAL;

  // Founders
  if (data.plan === "FOUNDERS") {
    return (
      <div className="bg-card border-border rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Plan Founders</h3>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Acceso completo a todas las funcionalidades. Gracias por ser parte desde el inicio.
        </p>
      </div>
    );
  }

  // Active subscription
  if (data.status === "ACTIVE") {
    return (
      <div className="bg-card border-border rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="text-primary h-4 w-4" />
          <h3 className="text-sm font-medium">Plan Personal — Activo</h3>
        </div>
        {data.currentPeriodEnd && (
          <p className="text-muted-foreground mt-2 text-xs">
            Próxima facturación: {formatDate(data.currentPeriodEnd)}
          </p>
        )}
        <div className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px]">
                Cancelar suscripción
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-full sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
                <AlertDialogDescription>
                  Si cancelás, vas a seguir teniendo acceso completo hasta el final del período
                  actual
                  {data.currentPeriodEnd ? ` (${formatDate(data.currentPeriodEnd)})` : ""}. Después,
                  tu cuenta pasará a modo lectura.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cancelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sí, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // Cancelled (still within period)
  if (data.status === "CANCELLED" && data.canWrite) {
    return (
      <div className="bg-card border-border rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Suscripción cancelada</h3>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Tenés acceso hasta el{" "}
          {data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : "final del período"}. Después
          tu cuenta pasará a modo lectura.
        </p>
        <div className="mt-4">
          <SubscribeButton
            billingFrequency={billingFrequency}
            setBillingFrequency={setBillingFrequency}
            onCheckout={handleCheckout}
            loading={checkoutLoading}
            plan={plan}
          />
        </div>
      </div>
    );
  }

  // Trialing
  if (data.status === "TRIALING") {
    return (
      <div className="bg-card border-border rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="text-primary h-4 w-4" />
          <h3 className="text-sm font-medium">Prueba gratis</h3>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {data.trialEndDate
            ? `Tu prueba gratis vence el ${formatDate(data.trialEndDate)}.`
            : "Estás en período de prueba."}
        </p>
        <div className="mt-4">
          <SubscribeButton
            billingFrequency={billingFrequency}
            setBillingFrequency={setBillingFrequency}
            onCheckout={handleCheckout}
            loading={checkoutLoading}
            plan={plan}
          />
        </div>
      </div>
    );
  }

  // Expired / Past Due / No subscription
  return (
    <div className="bg-card border-border rounded-lg border border-rose-200 p-5 dark:border-rose-900">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-rose-500" />
        <h3 className="text-sm font-medium">Suscripción requerida</h3>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Tu suscripción venció. Suscribite para seguir usando todas las funcionalidades.
      </p>
      <div className="mt-4">
        <SubscribeButton
          billingFrequency={billingFrequency}
          setBillingFrequency={setBillingFrequency}
          onCheckout={handleCheckout}
          loading={checkoutLoading}
          plan={plan}
        />
      </div>
    </div>
  );
}

function SubscribeButton({
  billingFrequency,
  setBillingFrequency,
  onCheckout,
  loading,
  plan,
}: {
  billingFrequency: "MONTHLY" | "ANNUAL";
  setBillingFrequency: (f: "MONTHLY" | "ANNUAL") => void;
  onCheckout: () => void;
  loading: boolean;
  plan: (typeof SUBSCRIPTION_PLANS)["PERSONAL"];
}) {
  const price =
    billingFrequency === "ANNUAL"
      ? formatPriceARS(plan.annualMonthlyPrice)
      : formatPriceARS(plan.monthlyPrice);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setBillingFrequency("MONTHLY")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            billingFrequency === "MONTHLY"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setBillingFrequency("ANNUAL")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            billingFrequency === "ANNUAL"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Anual
        </button>
        {billingFrequency === "ANNUAL" && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Ahorrá 17%
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-foreground text-lg font-bold">{price}</span>
        <span className="text-muted-foreground text-xs">/mes</span>
        {billingFrequency === "ANNUAL" && (
          <span className="text-muted-foreground ml-2 text-xs">
            ({formatPriceARS(getAnnualTotal())}/año)
          </span>
        )}
      </div>

      <Button onClick={onCheckout} disabled={loading} className="min-h-[44px] w-full sm:w-auto">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Suscribirse
      </Button>
    </div>
  );
}
