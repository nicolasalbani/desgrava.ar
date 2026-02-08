"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Calculator } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Calculator className="h-6 w-6" />
          desgrava.ar
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/simulador" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Simulador
          </Link>
          <Button asChild>
            {session ? (
              <Link href="/dashboard">Ir al panel</Link>
            ) : (
              <Link href="/login">Iniciar sesion</Link>
            )}
          </Button>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px]">
            <nav className="flex flex-col gap-4 mt-8">
              <Link href="/simulador" onClick={() => setOpen(false)} className="text-lg font-medium">
                Simulador
              </Link>
              {session ? (
                <Link href="/dashboard" onClick={() => setOpen(false)} className="text-lg font-medium">
                  Ir al panel
                </Link>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="text-lg font-medium">
                  Iniciar sesion
                </Link>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
