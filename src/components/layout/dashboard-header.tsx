"use client";

import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Menu, Sun, Moon, Monitor, ChevronDown, Check } from "lucide-react";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export function DashboardHeader() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { fiscalYear, setFiscalYear } = useFiscalYear();
  const [open, setOpen] = useState(false);
  const [fiscalYearOpen, setFiscalYearOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handler() {
      setFiscalYearOpen(true);
    }
    window.addEventListener("open-fiscal-year-selector", handler);
    return () => window.removeEventListener("open-fiscal-year-selector", handler);
  }, []);

  function cycleTheme() {
    const order = ["light", "dark", "system"] as const;
    const current = (theme ?? "system") as (typeof order)[number];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTheme(next);
  }

  const ThemeIcon = mounted ? (themeIcons[theme as keyof typeof themeIcons] ?? Monitor) : Monitor;

  return (
    <header className="border-border bg-background flex items-center gap-4 border-b px-6 py-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <DashboardMobileNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      {/* Fiscal year selector */}
      <Popover open={fiscalYearOpen} onOpenChange={setFiscalYearOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 px-2.5 text-sm font-medium",
              fiscalYear === null
                ? "text-muted-foreground/40 hover:text-muted-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {fiscalYear ?? "Año"}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="end">
          <p className="text-muted-foreground/60 px-3 py-1.5 text-xs font-medium">Año fiscal</p>
          {YEAR_OPTIONS.map((year) => (
            <button
              key={year}
              onClick={() => setFiscalYear(year)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors",
                year === fiscalYear
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {year}
              {year === fiscalYear && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        onClick={cycleTheme}
        className="text-muted-foreground hover:text-foreground"
      >
        <ThemeIcon className="h-4 w-4" />
      </Button>

      {session?.user && (
        <div className="flex items-center gap-3">
          <span className="text-foreground hidden text-sm font-medium sm:block">
            {session.user.name}
          </span>
          <Avatar className="ring-border h-9 w-9 ring-2">
            <AvatarImage src={session.user.image ?? undefined} />
            <AvatarFallback>{session.user.name?.charAt(0)?.toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </header>
  );
}
