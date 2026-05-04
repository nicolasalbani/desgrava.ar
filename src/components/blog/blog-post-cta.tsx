import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlogPostCta() {
  return (
    <aside className="border-border bg-muted/40 mt-12 rounded-2xl border p-6 md:p-8">
      <h3 className="text-foreground text-xl font-semibold tracking-tight md:text-2xl">
        Probá desgrava.ar 30 días gratis
      </h3>
      <p className="text-muted-foreground mt-2 text-base leading-relaxed">
        Conectás ARCA, importás tus comprobantes y ves cuánto podrías recuperar antes de pagar nada.
        Sin tarjeta, cancelás cuando quieras.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="h-12 text-base">
          <Link href="/login">
            Empezar ahora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Link
          href="/blog"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center justify-center text-sm transition-colors"
        >
          Ver más artículos
        </Link>
      </div>
    </aside>
  );
}
