"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calculator } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "invite_required"
      ? "Necesitas un código de invitación para crear una cuenta."
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Código de invitación inválido");
        setLoading(false);
        return;
      }

      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Ocurrió un error. Por favor intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Calculator className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">desgrava.ar</CardTitle>
        <CardDescription>
          Inicia sesion para gestionar tus deducciones y automatizar la carga en SiRADIG
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Código de invitación"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && code.trim() && handleSignIn()}
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={handleSignIn}
          disabled={!code.trim() || loading}
        >
          Continuar con Google
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Al continuar, aceptas que tus datos se usan unicamente para gestionar tus deducciones impositivas.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
