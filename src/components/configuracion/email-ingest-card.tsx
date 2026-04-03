"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Mail,
  Copy,
  RefreshCw,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface IngestLog {
  id: string;
  fromAddress: string;
  subject: string | null;
  status: string;
  attachmentCount: number;
  invoicesCreated: number;
  errorMessage: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof Check;
  }
> = {
  COMPLETED: { label: "Completado", variant: "default", icon: CheckCircle2 },
  PARTIAL: { label: "Parcial", variant: "secondary", icon: AlertCircle },
  PROCESSING: { label: "Procesando", variant: "outline", icon: Clock },
  RECEIVED: { label: "Recibido", variant: "outline", icon: Clock },
  FAILED: { label: "Fallido", variant: "destructive", icon: XCircle },
  REJECTED: { label: "Rechazado", variant: "destructive", icon: XCircle },
};

export function EmailIngestCard() {
  const [ingestEmail, setIngestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    fetchIngestEmail();
    fetchLogs();
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

  async function fetchLogs() {
    try {
      const res = await fetch("/api/email/logs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs.slice(0, 5));
    } catch {
      // Silent fail for logs
    } finally {
      setLogsLoading(false);
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

      {/* Recent activity */}
      {!logsLoading && logs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground/70 text-sm font-medium">Actividad reciente</h3>
          <div className="space-y-2">
            {logs.map((log) => {
              const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.FAILED;
              const Icon = config.icon;
              const isFailed = log.status === "FAILED" || log.status === "REJECTED";
              const iconColor = isFailed
                ? "text-destructive/70"
                : log.status === "COMPLETED"
                  ? "text-emerald-600/70"
                  : "text-muted-foreground/60";
              return (
                <div
                  key={log.id}
                  className="border-border space-y-1 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                      <span className="text-muted-foreground/70 truncate">
                        {log.subject || log.fromAddress}
                      </span>
                      {log.invoicesCreated > 0 && (
                        <span className="text-muted-foreground/50 text-xs">
                          ({log.invoicesCreated}{" "}
                          {log.invoicesCreated === 1 ? "comprobante" : "comprobantes"})
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                      <span className="text-muted-foreground/50 text-xs">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                  </div>
                  {isFailed && log.errorMessage && (
                    <p className="text-muted-foreground/50 pl-5 text-xs">{log.errorMessage}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
