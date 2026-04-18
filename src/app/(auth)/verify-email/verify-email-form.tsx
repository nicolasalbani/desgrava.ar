"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function VerifyEmailForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="mx-4 flex w-full max-w-md flex-col items-center">
        <Image src="/logo.png" alt="desgrava.ar" width={80} height={80} className="mb-6" />
        <Card className="w-full">
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Enlace inválido. Iniciá sesión o registrate para recibir un nuevo enlace.
            </p>
            <Link href="/login" className="inline-block text-sm underline underline-offset-4">
              Ir a iniciar sesión
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleVerify() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        router.push("/login?verified=true");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.error === "token_expired") {
        setError(
          "Este enlace ya fue usado o expiró. Si ya verificaste tu email, iniciá sesión directamente.",
        );
      } else {
        setError("No pudimos verificar tu email. Intentá de nuevo.");
      }
      setLoading(false);
    } catch {
      setError("Ocurrió un error. Por favor intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-4 flex w-full max-w-md flex-col items-center">
      <Image src="/logo.png" alt="desgrava.ar" width={80} height={80} className="mb-6" />
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verificá tu email</CardTitle>
          <CardDescription>
            Hacé clic en el botón para confirmar tu cuenta en desgrava.ar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <Button className="w-full" size="lg" onClick={handleVerify} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verificar email
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
