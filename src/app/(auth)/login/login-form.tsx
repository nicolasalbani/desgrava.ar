"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator";
import { isPasswordValid } from "@/lib/validators/password";
import Link from "next/link";

type View = "login" | "register";

export type LoginFormInitial = {
  error: string;
  success: string;
};

export function LoginForm({ initial }: { initial: LoginFormInitial }) {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initial.error);
  const [success, setSuccess] = useState(initial.success);
  const [loading, setLoading] = useState(false);

  async function handleCredentialsLogin() {
    setError("");
    setSuccess("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      if (result.error.includes("email_not_verified")) {
        setError(
          "Tenés que verificar tu email antes de iniciar sesión. Revisá tu bandeja de entrada.",
        );
      } else {
        setError("Email o contraseña incorrectos");
      }
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleRegister() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al crear la cuenta");
        setLoading(false);
        return;
      }

      if (data.requiresVerification) {
        setSuccess("Revisa tu email para verificar tu cuenta.");
        setView("login");
        setPassword("");
      } else {
        setSuccess(data.message ?? "Cuenta creada correctamente.");
        setView("login");
      }
    } catch {
      setError("Ocurrió un error. Por favor intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  const canSubmitLogin = email.trim() && password.trim();
  const passwordsMatch = password === confirmPassword;
  const canSubmitRegister = email.trim() && isPasswordValid(password) && passwordsMatch;

  return (
    <div className="mx-4 flex w-full max-w-md flex-col items-center">
      <Image src="/logo.png" alt="desgrava.ar" width={80} height={80} className="mb-6" />
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <Link href="/" className="transition-opacity hover:opacity-70">
              desgrava.ar
            </Link>
          </CardTitle>
          <CardDescription>
            {view === "login"
              ? "Inicia sesion y continuá gestionando tus deducciones"
              : "Crea una cuenta para empezar a gestionar tus deducciones"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              {success}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card text-muted-foreground px-2">o</span>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              disabled={loading}
              autoComplete={view === "login" ? "current-password" : "new-password"}
            />
            {view === "register" && <PasswordStrengthIndicator password={password} />}
            {view === "register" && (
              <>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  disabled={loading}
                  placeholder="Confirmar contraseña"
                  autoComplete="new-password"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-destructive text-xs">Las contraseñas no coinciden</p>
                )}
              </>
            )}
          </div>

          {view === "login" ? (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCredentialsLogin}
                disabled={!canSubmitLogin || loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión
              </Button>
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  Olvidé mi contraseña
                </Link>
              </div>
            </>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleRegister}
              disabled={!canSubmitRegister || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          )}

          <div className="text-center">
            {view === "login" ? (
              <button
                onClick={() => {
                  setView("register");
                  setError("");
                  setSuccess("");
                  setConfirmPassword("");
                }}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                ¿No tenes cuenta? Registrate
              </button>
            ) : (
              <button
                onClick={() => {
                  setView("login");
                  setError("");
                  setSuccess("");
                  setConfirmPassword("");
                }}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                ¿Ya tenes cuenta? Inicia sesión
              </button>
            )}
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Al continuar, aceptas que tus datos se usan unicamente para gestionar tus deducciones
            impositivas.
          </p>

          {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" && (
            <Button
              variant="outline"
              className="w-full border-dashed border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
              size="lg"
              onClick={async () => {
                setError("");
                setLoading(true);
                try {
                  const res = await fetch("/api/auth/dev-account", { method: "POST" });
                  if (!res.ok) throw new Error();
                  const { email: devEmail, password: devPassword } = await res.json();
                  const result = await signIn("credentials", {
                    email: devEmail,
                    password: devPassword,
                    redirect: false,
                  });
                  if (result?.error) throw new Error();
                  window.location.href = "/dashboard";
                } catch {
                  setError("Error al crear cuenta dev");
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Dev: crear cuenta rápida
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
