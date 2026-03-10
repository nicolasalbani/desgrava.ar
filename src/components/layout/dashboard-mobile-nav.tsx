"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  FileText,
  Send,
  Settings,
  Calculator,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/perfil", label: "Perfil", icon: User },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/automatizacion", label: "Enviar a SiRADIG", icon: Send },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

export function DashboardMobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" onClick={onNavigate}>
          <Calculator className="h-5 w-5" />
          desgrava.ar
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-border p-3 mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sm text-muted-foreground hover:text-red-500 hover:bg-transparent transition-colors duration-150"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </div>
  );
}
