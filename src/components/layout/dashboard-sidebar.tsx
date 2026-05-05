"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  KeyRound,
  FileText,
  Receipt,
  Send,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AttentionBadge } from "@/components/shared/attention-badge";
import { useAttentionCounts } from "@/contexts/attention-counts";
import { useDomesticWorkerCount } from "@/contexts/domestic-worker-count";
import { useEmployerCount } from "@/contexts/employer-count";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard },
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

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { facturas, recibos, perfil } = useAttentionCounts();
  const { hasWorkers, loading: workersLoading } = useDomesticWorkerCount();
  const { hasEmployers, loading: employersLoading } = useEmployerCount();

  const badgeCounts: Record<string, number> = {
    "/perfil": perfil,
    "/comprobantes": facturas,
    "/recibos": recibos,
  };

  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
      className={cn(
        "hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "border-border bg-background hidden h-full flex-col border-r transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "border-border flex h-16 items-center border-b",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          {!collapsed && (
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold"
              aria-label="desgrava.ar"
            >
              <Image src="/logo.png" alt="desgrava.ar" width={32} height={32} />
              <span>desgrava.ar</span>
            </Link>
          )}
          {toggleButton}
        </div>
        <ScrollArea className={cn("flex-1 py-4", collapsed ? "px-2" : "px-3")}>
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/panel" && pathname.startsWith(item.href));
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
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "flex cursor-not-allowed items-center rounded-lg text-sm opacity-50",
                          collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-2.5",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed && item.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{disabledTooltip}</TooltipContent>
                  </Tooltip>
                );
              }

              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.href === "/presentaciones" ? "nav-presentaciones" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-lg text-sm transition-colors duration-150",
                    collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed && item.label}
                  {badgeCount > 0 &&
                    (collapsed ? (
                      <AttentionBadge
                        count={badgeCount}
                        href={badgeHrefs[item.href]}
                        variant="compact"
                      />
                    ) : (
                      <AttentionBadge count={badgeCount} href={badgeHrefs[item.href]} />
                    ))}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
