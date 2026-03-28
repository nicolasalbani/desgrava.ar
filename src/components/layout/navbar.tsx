"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  BarChart3,
  CreditCard,
  LogIn,
  LayoutDashboard,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

const sectionLinks = [
  { label: "Cómo funciona", href: "/#desgrava", icon: Sparkles },
  { label: "Simulador", href: "/#simulador", icon: BarChart3 },
  { label: "Planes", href: "/#planes", icon: CreditCard },
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
    <header className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
        {isLanding ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-3 text-3xl font-bold"
          >
            <Image src="/logo.png" alt="desgrava.ar" width={40} height={40} className="h-10 w-10" />
            desgrava.ar
          </a>
        ) : (
          <Link href="/" className="flex items-center gap-3 text-3xl font-bold">
            <Image src="/logo.png" alt="desgrava.ar" width={40} height={40} className="h-10 w-10" />
            desgrava.ar
          </Link>
        )}

        <nav className="hidden items-center gap-8 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            <ThemeIcon className="h-5 w-5" />
          </Button>
          {isLanding
            ? sectionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground text-lg transition-colors"
                >
                  {link.label}
                </a>
              ))
            : sectionLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground text-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
          <Button asChild size="lg">
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
          {mounted && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetTitle className="sr-only">Menú</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="border-border flex h-16 items-center border-b px-6">
                    {isLanding ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex items-center gap-3 text-2xl font-bold"
                      >
                        <Image
                          src="/logo.png"
                          alt="desgrava.ar"
                          width={48}
                          height={48}
                          className="h-12 w-12"
                        />
                        desgrava.ar
                      </a>
                    ) : (
                      <Link
                        href="/"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-2xl font-bold"
                      >
                        <Image
                          src="/logo.png"
                          alt="desgrava.ar"
                          width={48}
                          height={48}
                          className="h-12 w-12"
                        />
                        desgrava.ar
                      </Link>
                    )}
                  </div>
                  <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
                    {sectionLinks.map((link) => {
                      const Icon = link.icon;
                      return isLanding ? (
                        <a
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-border border-t p-3">
                    {session ? (
                      <Button asChild className="w-full">
                        <Link href="/dashboard" onClick={() => setOpen(false)}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Ir al panel
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="w-full">
                        <Link href="/login" onClick={() => setOpen(false)}>
                          <LogIn className="mr-2 h-4 w-4" />
                          Iniciar sesion
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
