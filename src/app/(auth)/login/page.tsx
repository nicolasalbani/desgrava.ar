"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calculator } from "lucide-react";

export default function LoginPage() {
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
      <CardContent>
        <Button
          className="w-full"
          size="lg"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Continuar con Google
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Al continuar, aceptas que tus datos se usan unicamente para gestionar tus deducciones impositivas.
        </p>
      </CardContent>
    </Card>
  );
}
