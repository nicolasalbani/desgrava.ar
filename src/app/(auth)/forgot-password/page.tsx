"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al enviar el email");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Ocurrió un error. Por favor intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-4 w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Restablecer contraseña</CardTitle>
        <CardDescription>
          {sent
            ? "Si el email existe, recibirás un enlace para restablecer tu contraseña."
            : "Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {sent ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            Revisa tu bandeja de entrada. El enlace expira en 1 hora.
          </div>
        ) : (
          <>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email.trim() && handleSubmit()}
              disabled={loading}
              autoComplete="email"
            />
            <Button className="w-full" onClick={handleSubmit} disabled={!email.trim() || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace
            </Button>
          </>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver a iniciar sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
