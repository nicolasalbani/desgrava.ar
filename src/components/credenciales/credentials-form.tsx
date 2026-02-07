"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Trash2, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { formatCuit, validateCuit } from "@/lib/validators/cuit";
import { toast } from "sonner";

const formSchema = z.object({
  cuit: z
    .string()
    .min(1, "El CUIT es requerido")
    .refine(
      (val) => {
        const cleaned = val.replace(/-/g, "");
        return /^\d{11}$/.test(cleaned);
      },
      { message: "El CUIT debe tener 11 digitos" }
    )
    .refine(
      (val) => validateCuit(val.replace(/-/g, "")),
      { message: "El CUIT no es valido (digito verificador incorrecto)" }
    ),
  clave: z.string().min(1, "La clave fiscal es requerida"),
});

type FormData = z.infer<typeof formSchema>;

interface Credential {
  id: string;
  cuit: string;
  isValidated: boolean;
  updatedAt: string;
}

export function CredentialsForm() {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showClave, setShowClave] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { cuit: "", clave: "" },
  });

  useEffect(() => {
    fetchCredential();
  }, []);

  async function fetchCredential() {
    try {
      const res = await fetch("/api/credenciales");
      const data = await res.json();
      if (data.credential) {
        setCredential(data.credential);
        form.setValue("cuit", formatCuit(data.credential.cuit));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/credenciales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuit: data.cuit.replace(/-/g, ""),
          clave: data.clave,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
        return;
      }

      const saved = await res.json();
      setCredential(saved);
      form.setValue("clave", "");
      toast.success("Credenciales guardadas correctamente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch("/api/credenciales", { method: "DELETE" });
      setCredential(null);
      form.reset();
      toast.success("Credenciales eliminadas");
    } finally {
      setDeleting(false);
    }
  }

  function handleCuitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCuit(e.target.value);
    form.setValue("cuit", formatted, { shouldValidate: true });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6" />
            <div>
              <CardTitle>Credenciales ARCA</CardTitle>
              <CardDescription>
                Tu CUIT y clave fiscal para acceder a SiRADIG
              </CardDescription>
            </div>
          </div>
          {credential && (
            <Badge variant={credential.isValidated ? "default" : "secondary"}>
              {credential.isValidated ? "Validada" : "Sin validar"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertDescription>
            Tu clave fiscal se encripta con AES-256-GCM antes de guardarse. Nunca
            se almacena en texto plano ni se muestra en la interfaz.
          </AlertDescription>
        </Alert>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cuit">CUIT</Label>
            <Input
              id="cuit"
              placeholder="XX-XXXXXXXX-X"
              {...form.register("cuit")}
              onChange={handleCuitChange}
            />
            {form.formState.errors.cuit && (
              <p className="text-sm text-destructive">
                {form.formState.errors.cuit.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clave">Clave fiscal</Label>
            <div className="relative">
              <Input
                id="clave"
                type={showClave ? "text" : "password"}
                placeholder={credential ? "••••••••" : "Ingresa tu clave fiscal"}
                {...form.register("clave")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowClave(!showClave)}
              >
                {showClave ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.clave && (
              <p className="text-sm text-destructive">
                {form.formState.errors.clave.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {credential ? "Actualizar" : "Guardar"}
            </Button>

            {credential && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar
              </Button>
            )}
          </div>
        </form>

        {credential && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Ultima actualizacion:{" "}
              {new Date(credential.updatedAt).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
