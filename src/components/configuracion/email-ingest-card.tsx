"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Mail, Copy, RefreshCw, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function EmailIngestCard() {
  const [ingestEmail, setIngestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetchIngestEmail();
  }, []);

  async function fetchIngestEmail() {
    try {
      const res = await fetch("/api/email/token");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIngestEmail(data.ingestEmail);
    } catch {
      toast.error("Error al obtener el email de ingesta");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ingestEmail);
      setCopied(true);
      toast.success("Email copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/email/token", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIngestEmail(data.ingestEmail);
      toast.success("Email de ingesta regenerado");
    } catch {
      toast.error("Error al regenerar el email");
    } finally {
      setRegenerating(false);
      setConfirmOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-muted-foreground/70 flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" />
          <span>Envia comprobantes como adjuntos a este email y se cargan automaticamente</span>
        </div>

        <div className="flex items-center gap-2">
          <Input readOnly value={ingestEmail} className="bg-muted/40 font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            Regenerar email
          </Button>
          <p className="text-muted-foreground/50 text-xs">
            La direccion anterior dejara de funcionar
          </p>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar email de ingesta</AlertDialogTitle>
            <AlertDialogDescription>
              Se generara una nueva direccion de email. La direccion anterior dejara de funcionar
              inmediatamente. Cualquier email enviado a la direccion anterior sera rechazado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>Regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
