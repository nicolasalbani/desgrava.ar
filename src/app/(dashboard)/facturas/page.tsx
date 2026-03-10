"use client";

import { useState, useRef, useEffect, Suspense, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, PenLine, Mail, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileUploader } from "@/components/facturas/file-uploader";
import { InvoiceForm } from "@/components/facturas/invoice-form";
import { InvoiceList } from "@/components/facturas/invoice-list";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Expanding icon button ────────────────────────────────────────

function ExpandingButton({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  className,
}: {
  icon: ElementType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: "outline" | "default";
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className={cn("group gap-0 overflow-hidden transition-all duration-300", className)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="max-w-0 overflow-hidden opacity-0 whitespace-nowrap group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-out">
        {label}
      </span>
    </Button>
  );
}

// ── Email dialog ────────────────────────────────────────────────

function EmailIngestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/email/token")
      .then((r) => r.json())
      .then((d) => setEmail(d.ingestEmail ?? ""))
      .catch(() => toast.error("No se pudo obtener el email"));
  }, [open]);

  async function handleCopy() {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Subir factura por email</DialogTitle>
          <DialogDescription>
            Envia un email con tu factura adjunta (PDF, JPG o PNG) a esta
            direccion y la procesamos automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <span className="text-sm font-mono whitespace-nowrap select-all text-foreground/80">
              {email || "Cargando..."}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              disabled={!email}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            Podes gestionar esta direccion desde{" "}
            <a
              href="/configuracion"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Configuracion
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Onboarding intro panel ──────────────────────────────────────

const METHOD_CARDS = [
  {
    key: "upload",
    icon: Upload,
    title: "Subir archivo",
    description:
      "Arrastra un PDF, JPG o PNG. Extraemos los datos automaticamente con OCR.",
    cta: "Subir",
  },
  {
    key: "email",
    icon: Mail,
    title: "Por email",
    description:
      "Envia un email con la factura adjunta a tu direccion personal de carga.",
    cta: "Ver direccion",
  },
  {
    key: "manual",
    icon: PenLine,
    title: "Carga manual",
    description:
      "Ingresa los datos del comprobante a mano si no tenes el archivo.",
    cta: "Cargar",
  },
] as const;

function IntroBanner({
  onAction,
  onDismiss,
}: {
  onAction: (key: (typeof METHOD_CARDS)[number]["key"]) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-400">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60">
        <p className="text-sm font-medium text-foreground/80">
          Tres formas de agregar tus comprobantes
        </p>
        <button
          onClick={onDismiss}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
        {METHOD_CARDS.map(({ key, icon: Icon, title, description, cta }) => (
          <button
            key={key}
            onClick={() => onAction(key)}
            className="group text-left px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed mb-3">
              {description}
            </p>
            <span className="text-xs font-medium text-primary group-hover:underline underline-offset-2">
              {cta} →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Inner page (needs useSearchParams) ─────────────────────────

function FacturasInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hadZeroInvoices = useRef(false);
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(
    () => searchParams.get("intro") === "1"
  );

  function handleInitialLoad(count: number) {
    if (!firstLoadDone.current) {
      firstLoadDone.current = true;
      hadZeroInvoices.current = count === 0;
    }
  }

  function handleSaved() {
    setUploadOpen(false);
    setManualOpen(false);
    if (hadZeroInvoices.current) {
      router.push("/dashboard");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  function openUpload() {
    setShowIntro(false);
    setUploadOpen(true);
  }
  function openManual() {
    setShowIntro(false);
    setManualOpen(true);
  }
  function openEmail() {
    setShowIntro(false);
    setEmailOpen(true);
  }

  function handleIntroAction(key: (typeof METHOD_CARDS)[number]["key"]) {
    if (key === "upload") openUpload();
    else if (key === "email") openEmail();
    else openManual();
  }

  return (
    <div className="space-y-6">
      <div
        className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Comprobantes para deducciones SiRADIG
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExpandingButton
            icon={PenLine}
            label="Carga manual"
            onClick={openManual}
            className={cn(showIntro && "ring-2 ring-primary/20")}
          />
          <ExpandingButton
            icon={Mail}
            label="Por email"
            onClick={openEmail}
            className={cn(showIntro && "ring-2 ring-primary/20")}
          />
          <ExpandingButton
            icon={Upload}
            label="Subir archivo"
            onClick={openUpload}
            variant="default"
            className={cn(showIntro && "ring-2 ring-primary/30")}
          />
        </div>
      </div>

      {showIntro && (
        <IntroBanner
          onAction={handleIntroAction}
          onDismiss={() => setShowIntro(false)}
        />
      )}

      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <InvoiceList key={refreshKey} onInitialLoad={handleInitialLoad} />
      </div>

      <EmailIngestDialog open={emailOpen} onOpenChange={setEmailOpen} />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden [grid-template-rows:auto_1fr]">
          <DialogHeader>
            <DialogTitle>Subir comprobante</DialogTitle>
            <DialogDescription>
              Subi un archivo PDF, JPG, PNG o WebP y extraeremos los datos
              automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto min-h-0">
            <FileUploader onInvoiceSaved={handleSaved} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden [grid-template-rows:auto_1fr]">
          <DialogHeader>
            <DialogTitle>Carga manual</DialogTitle>
            <DialogDescription>
              Ingresa los datos del comprobante manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto min-h-0">
            <InvoiceForm
              onSaved={handleSaved}
              onCancel={() => setManualOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FacturasPage() {
  return (
    <Suspense>
      <FacturasInner />
    </Suspense>
  );
}
