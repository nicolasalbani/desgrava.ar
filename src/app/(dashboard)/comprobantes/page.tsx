"use client";

import { useState, useRef, useEffect, Suspense, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, PenLine, Mail, Copy, Check, X, Download, FileText } from "lucide-react";
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
import { ArcaImportButton } from "@/components/shared/arca-import-button";
import { UploadSpotlight } from "@/components/facturas/upload-spotlight";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useFiscalYearReadOnly } from "@/hooks/use-fiscal-year-read-only";
import { useEmployerCount } from "@/contexts/employer-count";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

// ── Expanding icon button ────────────────────────────────────────

function ExpandingButton({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  className,
  disabled,
}: {
  icon: ElementType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: "outline" | "default";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={cn("group gap-0 overflow-hidden transition-all duration-300", className)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[200px] group-hover:opacity-100">
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
          <DialogTitle>Subir comprobante por email</DialogTitle>
          <DialogDescription>
            Envia un email con tu comprobante adjunto (PDF, JPG o PNG) a esta direccion y lo
            procesamos automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="border-border bg-muted/40 flex items-center gap-2 rounded-xl border px-3 py-2.5">
            <Mail className="text-muted-foreground/60 h-4 w-4 shrink-0" />
            <span className="text-foreground/80 font-mono text-sm whitespace-nowrap select-all">
              {email || "Cargando..."}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 shrink-0 px-2"
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
          <p className="text-muted-foreground/60 text-xs leading-relaxed">
            Podes gestionar esta direccion desde{" "}
            <a
              href="/configuracion"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
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
    description: "Arrastra un PDF, JPG o PNG. Extraemos los datos automaticamente con OCR.",
    cta: "Subir",
  },
  {
    key: "email",
    icon: Mail,
    title: "Por email",
    description: "Envia un email con el comprobante adjunto a tu direccion personal de carga.",
    cta: "Ver direccion",
  },
  {
    key: "manual",
    icon: PenLine,
    title: "Carga manual",
    description: "Ingresa los datos del comprobante a mano si no tenes el archivo.",
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
    <div className="border-border bg-card animate-in fade-in slide-in-from-top-2 rounded-2xl border shadow-sm duration-400">
      <div className="border-border/60 flex items-center justify-between border-b px-5 pt-4 pb-3">
        <p className="text-foreground/80 text-sm font-medium">
          Tres formas de agregar tus comprobantes
        </p>
        <button
          onClick={onDismiss}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-border/60 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {METHOD_CARDS.map(({ key, icon: Icon, title, description, cta }) => (
          <button
            key={key}
            onClick={() => onAction(key)}
            className="group hover:bg-muted/30 px-5 py-4 text-left transition-colors"
          >
            <div className="mb-2 flex items-center gap-2.5">
              <div className="bg-primary/8 group-hover:bg-primary/12 flex h-7 w-7 items-center justify-center rounded-lg transition-colors">
                <Icon className="text-primary h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-muted-foreground/70 mb-3 text-xs leading-relaxed">{description}</p>
            <span className="text-primary text-xs font-medium underline-offset-2 group-hover:underline">
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
  const readOnly = useFiscalYearReadOnly();
  const { fiscalYear } = useFiscalYear();
  const { hasEmployers, loading: employersLoading } = useEmployerCount();
  const { snapshot } = useArcaImportProgress();
  const hadZeroInvoices = useRef(false);
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(() => searchParams.get("intro") === "1");

  // Refresh the list when a PULL_COMPROBANTES job transitions from running to
  // completed. The strip handles all other progress feedback.
  const wasComprobantesCompleted = useRef(false);
  useEffect(() => {
    const isCompleted = snapshot.completedTypes.includes("PULL_COMPROBANTES");
    if (isCompleted && !wasComprobantesCompleted.current) {
      setRefreshKey((k) => k + 1);
    }
    wasComprobantesCompleted.current = isCompleted;
  }, [snapshot.completedTypes]);

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

  if (!employersLoading && !hasEmployers) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <FileText className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
          <h2 className="text-lg font-semibold">Sin empleadores registrados</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Para cargar comprobantes deducibles necesitás tener al menos un empleador en tu perfil
            impositivo.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/perfil")}>
            Ir a Perfil impositivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 flex items-center justify-between duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comprobantes deducibles</h1>
          <p className="text-muted-foreground/70 mt-1 text-sm">
            Comprobantes para deducciones SiRADIG
          </p>
        </div>
        <div data-tour="facturas-actions" className="flex items-center gap-2">
          <ArcaImportButton
            mode="toolbar"
            jobType="PULL_COMPROBANTES"
            fiscalYear={fiscalYear}
            icon={Download}
            disabled={readOnly}
          />
          <ExpandingButton
            icon={PenLine}
            label="Carga manual"
            onClick={openManual}
            disabled={readOnly}
            className={cn(showIntro && "ring-primary/20 ring-2")}
          />
          <ExpandingButton
            icon={Mail}
            label="Por email"
            onClick={openEmail}
            disabled={readOnly}
            className={cn(showIntro && "ring-primary/20 ring-2")}
          />
          <ExpandingButton
            icon={Upload}
            label="Subir archivo"
            onClick={openUpload}
            disabled={readOnly}
            variant="default"
            className={cn(showIntro && "ring-primary/30 ring-2")}
          />
        </div>
      </div>

      {showIntro && (
        <IntroBanner onAction={handleIntroAction} onDismiss={() => setShowIntro(false)} />
      )}

      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <InvoiceList
          key={refreshKey}
          onInitialLoad={handleInitialLoad}
          attentionFilter={searchParams.get("filter") === "attention"}
          readOnly={readOnly}
        />
      </div>

      <EmailIngestDialog open={emailOpen} onOpenChange={setEmailOpen} />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] [grid-template-rows:auto_1fr] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir comprobante</DialogTitle>
            <DialogDescription>
              Subi un archivo PDF, JPG, PNG o WebP y extraeremos los datos automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <FileUploader onInvoiceSaved={handleSaved} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[90vh] [grid-template-rows:auto_1fr] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carga manual</DialogTitle>
            <DialogDescription>Ingresa los datos del comprobante manualmente.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <InvoiceForm onSaved={handleSaved} onCancel={() => setManualOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <UploadSpotlight />
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
