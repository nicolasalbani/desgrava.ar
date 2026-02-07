import { Calculator } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-8 mt-auto">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calculator className="h-4 w-4" />
          desgrava.ar
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/simulador" className="hover:text-foreground transition-colors">
            Simulador
          </Link>
        </nav>
        <p className="text-sm text-muted-foreground">
          {new Date().getFullYear()} desgrava.ar. No afiliado a ARCA/AFIP.
        </p>
      </div>
    </footer>
  );
}
