"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Calculator, Sun, Moon, Monitor } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

const sectionLinks = [
  { label: "Desgravá", href: "/#desgrava" },
  { label: "Simulador", href: "/#simulador" },
  { label: "Planes", href: "/#planes" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  function cycleTheme() {
    const order = ["light", "dark", "system"] as const;
    const current = (theme ?? "system") as (typeof order)[number];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTheme(next);
  }

  const ThemeIcon = mounted ? (themeIcons[theme as keyof typeof themeIcons] ?? Monitor) : Monitor;

  const isLanding = pathname === "/";

  return (
    <header className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
        {isLanding ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 text-lg font-bold"
          >
            <Calculator className="h-5 w-5" />
            desgrava.ar
          </a>
        ) : (
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <Calculator className="h-5 w-5" />
            desgrava.ar
          </Link>
        )}

        <nav className="hidden items-center gap-6 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          {isLanding
            ? sectionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {link.label}
                </a>
              ))
            : sectionLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
          <Button asChild size="sm">
            {session ? (
              <Link href="/dashboard">Ir al panel</Link>
            ) : (
              <Link href="/login">Iniciar sesion</Link>
            )}
          </Button>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <nav className="mt-8 flex flex-col gap-4">
                {isLanding
                  ? sectionLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="text-muted-foreground hover:text-foreground text-base transition-colors"
                      >
                        {link.label}
                      </a>
                    ))
                  : sectionLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="text-muted-foreground hover:text-foreground text-base transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                {session ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground text-base transition-colors"
                  >
                    Ir al panel
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground text-base transition-colors"
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
