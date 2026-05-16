import Link from "next/link";
import { CreditCard, Crown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionInfo {
  plan: string;
  status: string;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionCardProps {
  subscription: SubscriptionInfo | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  return (
    <Link
      href="/configuracion#subscription"
      className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border hover:border-foreground/20 block rounded-2xl border p-5 transition-colors duration-500"
      style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
    >
      <h2 className="mb-3 text-sm font-semibold">Tu plan</h2>
      {subscription ? (
        <SubscriptionBody subscription={subscription} />
      ) : (
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <p className="text-muted-foreground text-sm">Sin suscripción activa</p>
          <span className="text-foreground ml-auto text-sm font-medium underline-offset-2 hover:underline">
            Suscribirse
          </span>
        </div>
      )}
    </Link>
  );
}

function SubscriptionBody({ subscription }: { subscription: SubscriptionInfo }) {
  const { plan, status, trialEndDate, currentPeriodEnd } = subscription;
  const planLabel = plan === "FOUNDERS" ? "Founders" : "Personal";

  if (plan === "FOUNDERS") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel}</p>
          <p className="text-muted-foreground text-xs">Acceso permanente</p>
        </div>
      </div>
    );
  }

  if (status === "TRIALING" && trialEndDate) {
    const days = daysUntil(trialEndDate);
    return (
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
          <CreditCard className="text-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel} — Prueba gratuita</p>
          <p className="text-muted-foreground text-xs">
            {days > 0
              ? `${days} día${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""} (vence ${formatDate(trialEndDate)})`
              : `Vencida el ${formatDate(trialEndDate)}`}
          </p>
        </div>
      </div>
    );
  }

  if (status === "ACTIVE" && currentPeriodEnd) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel}</p>
          <p className="text-muted-foreground text-xs">
            Próximo cobro: {formatDate(currentPeriodEnd)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "CANCELLED" && currentPeriodEnd) {
    return (
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-xl">
          <CreditCard className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel} — Cancelado</p>
          <p className="text-muted-foreground text-xs">
            Acceso hasta {formatDate(currentPeriodEnd)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <div className="flex-1">
        <p className="text-sm font-medium">{planLabel}</p>
        <p className="text-muted-foreground text-xs">
          {status === "PAST_DUE" ? "Pago pendiente" : "Suscripción vencida"}
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/configuracion">Renovar</Link>
      </Button>
    </div>
  );
}
