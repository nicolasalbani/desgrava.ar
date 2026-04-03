"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, User, KeyRound, FileText, Receipt, Settings, LogOut } from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AttentionBadge } from "@/components/shared/attention-badge";
import { useAttentionCounts } from "@/contexts/attention-counts";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/credenciales", label: "Credenciales ARCA", icon: KeyRound },
  { href: "/perfil", label: "Perfil impositivo", icon: User },
  { href: "/facturas", label: "Comprobantes deducibles", icon: FileText },
  { href: "/recibos", label: "Recibos salariales", icon: Receipt },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

const badgeHrefs: Record<string, string> = {
  "/facturas": "/facturas?filter=attention",
  "/recibos": "/recibos?filter=attention",
};

export function DashboardMobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { facturas, recibos } = useAttentionCounts();

  const badgeCounts: Record<string, number> = {
    "/facturas": facturas,
    "/recibos": recibos,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold" onClick={onNavigate}>
          <Image src="/logo.png" alt="desgrava.ar" width={20} height={20} />
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
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
      <div className="border-border mt-auto border-t p-3">
        <Button
          variant="ghost"
          className="text-muted-foreground w-full justify-start gap-3 text-sm transition-colors duration-150 hover:bg-transparent hover:text-red-500"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </div>
  );
}
