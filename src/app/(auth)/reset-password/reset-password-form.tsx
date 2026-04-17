"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator";
import { isPasswordValid } from "@/lib/validators/password";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Enlace inválido. Solicita un nuevo enlace desde la página de inicio de sesión.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al restablecer la contraseña");
        setLoading(false);
        return;
      }

      router.push("/login?reset=true");
    } catch {
      setError("Ocurrió un error. Por favor intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-4 w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Nueva contraseña</CardTitle>
        <CardDescription>Ingresa tu nueva contraseña.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <PasswordInput
          value={password}
          onChange={setPassword}
          disabled={loading}
          autoComplete="new-password"
        />
        <PasswordStrengthIndicator password={password} />

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!isPasswordValid(password) || loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Actualizar contraseña
        </Button>
      </CardContent>
    </Card>
  );
}
