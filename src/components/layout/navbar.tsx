"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Calculator, Sun, Moon, Monitor } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  function cycleTheme() {
    const order = ["light", "dark", "system"] as const;
    const current = (theme ?? "system") as (typeof order)[number];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTheme(next);
  }

  const ThemeIcon = mounted
    ? (themeIcons[(theme as keyof typeof themeIcons)] ?? Monitor)
    : Monitor;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Calculator className="h-5 w-5" />
          desgrava.ar
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={cycleTheme} className="text-muted-foreground hover:text-foreground">
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Link
            href="/simulador"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Simulador
          </Link>
          <Button asChild size="sm">
            {session ? (
              <Link href="/dashboard">Ir al panel</Link>
            ) : (
              <Link href="/login">Iniciar sesion</Link>
            )}
          </Button>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" size="icon" onClick={cycleTheme} className="text-muted-foreground hover:text-foreground">
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/simulador"
                  onClick={() => setOpen(false)}
                  className="text-base text-muted-foreground hover:text-foreground transition-colors"
                >
                  Simulador
                </Link>
                {session ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="text-base text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ir al panel
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="text-base text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Iniciar sesion
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
