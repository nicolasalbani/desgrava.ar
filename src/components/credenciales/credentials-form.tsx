"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Lock,
} from "lucide-react";
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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

      // Validate credentials after saving
      const valRes = await fetch("/api/credenciales/validar", {
        method: "POST",
      });
      if (valRes.ok) {
        saved.isValidated = true;
      }

      setCredential(saved);
      form.setValue("clave", "");
      toast.success("Credenciales guardadas correctamente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteOpen(false);
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Status banner */}
      {credential && (
        <div className="flex items-center gap-4 rounded-2xl bg-muted/50 px-5 py-4">
          <div
            className={`shrink-0 rounded-full p-2.5 ${
              credential.isValidated
                ? "bg-emerald-500/10"
                : "bg-amber-500/10"
            }`}
          >
            {credential.isValidated ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {credential.isValidated
                ? "Credenciales validadas"
                : "Credenciales sin validar"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {credential.isValidated
                ? "Listas para automatizar la carga en SiRADIG"
                : "Guarda tu clave fiscal para validarlas"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground/60 shrink-0">
            {new Date(credential.updatedAt).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
              placeholder={
                credential ? "••••••••" : "Ingresa tu clave fiscal"
              }
              {...form.register("clave")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              onClick={() => setShowClave(!showClave)}
            >
              {showClave ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.formState.errors.clave && (
            <p className="text-sm text-destructive">
              {form.formState.errors.clave.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {credential ? "Actualizar" : "Guardar"}
          </Button>

          {credential && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              title="Eliminar credenciales"
              className="text-muted-foreground hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </form>

      {/* Security note */}
      <div className="flex items-start gap-2.5 text-xs text-muted-foreground/50">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Tu clave fiscal se encripta con AES-256-GCM antes de guardarse.
          Nunca se almacena en texto plano ni se muestra en la interfaz.
        </p>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar credenciales</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminaran tu CUIT y clave fiscal. No podras automatizar la
              carga en SiRADIG hasta que las vuelvas a cargar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
