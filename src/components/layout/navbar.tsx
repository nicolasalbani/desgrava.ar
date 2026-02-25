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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Calculator className="h-5 w-5" />
          desgrava.ar
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/simulador"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
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

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <nav className="flex flex-col gap-4 mt-8">
              <Link
                href="/simulador"
                onClick={() => setOpen(false)}
                className="text-base text-gray-600 hover:text-gray-900 transition-colors"
              >
                Simulador
              </Link>
              {session ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Ir al panel
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-base text-gray-600 hover:text-gray-900 transition-colors"
                >
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
