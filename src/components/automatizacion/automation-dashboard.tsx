"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2, Play, Eye, CheckCircle, XCircle } from "lucide-react";
import { DEDUCTION_CATEGORY_LABELS } from "@/lib/validators/invoice";
import { toast } from "sonner";
import { JobDetail } from "./job-detail";

interface Job {
  id: string;
  jobType: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  invoice: {
    deductionCategory: string;
    providerCuit: string;
    amount: string;
    fiscalMonth: number;
    fiscalYear: number;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  RUNNING: { label: "Ejecutando", variant: "outline" },
  WAITING_CONFIRMATION: { label: "Esperando confirmacion", variant: "outline" },
  COMPLETED: { label: "Completado", variant: "default" },
  FAILED: { label: "Error", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

export function AutomationDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/automatizacion");
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(jobId: string) {
    const res = await fetch(`/api/automatizacion/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });

    if (res.ok) {
      toast.success("Job confirmado");
      fetchJobs();
    } else {
      toast.error("Error al confirmar");
    }
  }

  async function handleCancel(jobId: string) {
    const res = await fetch(`/api/automatizacion/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (res.ok) {
      toast.success("Job cancelado");
      fetchJobs();
    } else {
      toast.error("Error al cancelar");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6" />
            <div>
              <CardTitle>Cola de trabajos</CardTitle>
              <CardDescription>
                Jobs de automatizacion para cargar deducciones en SiRADIG
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay trabajos de automatizacion.</p>
              <p className="text-sm mt-1">
                Selecciona facturas pendientes y envialas a SiRADIG desde la pagina de facturas.
              </p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Intentos</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const statusConfig = STATUS_CONFIG[job.status] ?? {
                      label: job.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          {job.invoice ? (
                            <div>
                              <p className="font-medium">
                                {DEDUCTION_CATEGORY_LABELS[
                                  job.invoice.deductionCategory
                                ] ?? job.invoice.deductionCategory}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${parseFloat(job.invoice.amount).toLocaleString("es-AR")}{" "}
                                - {job.invoice.fiscalMonth}/{job.invoice.fiscalYear}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {job.jobType}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                          {job.errorMessage && (
                            <p className="text-xs text-destructive mt-1">
                              {job.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{job.attempts}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(job.createdAt).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedJob(job.id)}
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {job.status === "WAITING_CONFIRMATION" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleConfirm(job.id)}
                                  title="Confirmar"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancel(job.id)}
                                  title="Cancelar"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalle del trabajo</DialogTitle>
            <DialogDescription>
              Logs y estado del job de automatizacion
            </DialogDescription>
          </DialogHeader>
          {selectedJob && <JobDetail jobId={selectedJob} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
