"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, User, KeyRound, FileText, Receipt, Send, Settings } from "lucide-react";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AttentionBadge } from "@/components/shared/attention-badge";
import { useAttentionCounts } from "@/contexts/attention-counts";
import { useDomesticWorkerCount } from "@/contexts/domestic-worker-count";
import { useEmployerCount } from "@/contexts/employer-count";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/credenciales", label: "Credenciales ARCA", icon: KeyRound },
  { href: "/perfil", label: "Perfil impositivo", icon: User },
  { href: "/comprobantes", label: "Comprobantes", icon: FileText },
  { href: "/recibos", label: "Recibos salariales", icon: Receipt },
  { href: "/presentaciones", label: "Presentaciones", icon: Send },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

const badgeHrefs: Record<string, string> = {
  "/perfil": "/perfil",
  "/comprobantes": "/comprobantes?filter=attention",
  "/recibos": "/recibos?filter=attention",
};

export function DashboardMobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { facturas, recibos, perfil } = useAttentionCounts();
  const { hasWorkers, loading: workersLoading } = useDomesticWorkerCount();
  const { hasEmployers, loading: employersLoading } = useEmployerCount();

  const badgeCounts: Record<string, number> = {
    "/perfil": perfil,
    "/comprobantes": facturas,
    "/recibos": recibos,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold" onClick={onNavigate}>
          <Image src="/logo.png" alt="desgrava.ar" width={40} height={40} />
          desgrava.ar
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const badgeCount = badgeCounts[item.href];
            const isDisabledRecibos = item.href === "/recibos" && !workersLoading && !hasWorkers;
            const isDisabledFacturas =
              item.href === "/comprobantes" && !employersLoading && !hasEmployers;
            const isDisabled = isDisabledRecibos || isDisabledFacturas;
            const disabledTooltip = isDisabledRecibos
              ? "Primero registrá trabajadores a cargo en Perfil impositivo"
              : "Primero importá tu perfil impositivo con al menos un empleador";

            if (isDisabled) {
              return (
                <TooltipProvider key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm opacity-50">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{disabledTooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                data-tour={
                  item.href === "/presentaciones" ? "nav-presentaciones-mobile" : undefined
                }
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {badgeCount > 0 && (
                  <AttentionBadge
                    count={badgeCount}
                    href={badgeHrefs[item.href]}
                    onClick={onNavigate}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
