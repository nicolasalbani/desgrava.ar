"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────

const TIPO_DOC_OPTIONS = ["CUIT", "CUIL", "CDI", "DNI", "LC", "LE"] as const;

const PARENTESCO_OPTIONS = [
  { value: "1", label: "Cónyuge" },
  { value: "3", label: "Hijo/a menor de 18 años" },
  { value: "30", label: "Hijastro/a menor de 18 años" },
  { value: "31", label: "Hijo/a incapacitado para el trabajo" },
  { value: "32", label: "Hijastro/a incapacitado para el trabajo" },
  { value: "51", label: "Unión convivencial" },
] as const;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const UNION_PARENTESCOS = new Set(["1", "51"]);
const HIJO_PARENTESCOS = new Set(["3", "30", "31", "32"]);

function parentescoLabel(value: string) {
  return PARENTESCO_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

function unionDateLabel(parentesco: string) {
  return parentesco === "1" ? "Fecha de Casamiento" : "Fecha de Unión Convivencial";
}

// ── Zod schema ───────────────────────────────────────────────────

const schema = z.object({
  tipoDoc: z.enum(["CUIT", "CUIL", "CDI", "DNI", "LC", "LE"]),
  numeroDoc: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  nombre: z.string().min(1, "Requerido"),
  fechaNacimiento: z.string().optional(),
  parentesco: z.enum(["1", "3", "30", "31", "32", "51"]),
  fechaUnion: z.string().optional(),
  porcentajeDed: z.string().optional(),
  cuitOtroDed: z.string().optional(),
  familiaCargo: z.boolean(),
  residente: z.boolean(),
  tieneIngresos: z.boolean(),
  montoIngresos: z.string().optional(),
  mesDesde: z.number().int().min(1).max(12),
  mesHasta: z.number().int().min(1).max(12),
  proximosPeriodos: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const defaultValues: FormData = {
  tipoDoc: "DNI",
  numeroDoc: "",
  apellido: "",
  nombre: "",
  fechaNacimiento: "",
  parentesco: "3",
  fechaUnion: "",
  porcentajeDed: "",
  cuitOtroDed: "",
  familiaCargo: true,
  residente: true,
  tieneIngresos: false,
  montoIngresos: "",
  mesDesde: 1,
  mesHasta: 12,
  proximosPeriodos: true,
};

// ── Types ────────────────────────────────────────────────────────

interface FamilyDependent {
  id: string;
  tipoDoc: string;
  numeroDoc: string;
  apellido: string;
  nombre: string;
  fechaNacimiento: string | null;
  parentesco: string;
  fechaUnion: string | null;
  porcentajeDed: string | null;
  cuitOtroDed: string | null;
  familiaCargo: boolean;
  residente: boolean;
  tieneIngresos: boolean;
  montoIngresos: string | null;
  mesDesde: number;
  mesHasta: number;
  proximosPeriodos: boolean;
}

// ── Dependent form dialog ────────────────────────────────────────

function DependentDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  fiscalYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FamilyDependent | null;
  onSaved: (dep: FamilyDependent) => void;
  fiscalYear: number;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [saving, setSaving] = useState(false);

  const parentesco = form.watch("parentesco");
  const tieneIngresos = form.watch("tieneIngresos");
  const porcentajeDed = form.watch("porcentajeDed");
  const mesHasta = form.watch("mesHasta");

  const isUnion = UNION_PARENTESCOS.has(parentesco);
  const isHijo = HIJO_PARENTESCOS.has(parentesco);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        tipoDoc: editing.tipoDoc as FormData["tipoDoc"],
        numeroDoc: editing.numeroDoc,
        apellido: editing.apellido,
        nombre: editing.nombre,
        fechaNacimiento: editing.fechaNacimiento ?? "",
        parentesco: editing.parentesco as FormData["parentesco"],
        fechaUnion: editing.fechaUnion ?? "",
        porcentajeDed: editing.porcentajeDed ?? "",
        cuitOtroDed: editing.cuitOtroDed ?? "",
        familiaCargo: editing.familiaCargo,
        residente: editing.residente,
        tieneIngresos: editing.tieneIngresos,
        montoIngresos: editing.montoIngresos ?? "",
        mesDesde: editing.mesDesde,
        mesHasta: editing.mesHasta,
        proximosPeriodos: editing.proximosPeriodos,
      });
    } else {
      form.reset(defaultValues);
    }
  }, [open, editing, form]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const url = editing
        ? `/api/cargas-familia/${editing.id}`
        : "/api/cargas-familia";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, fiscalYear }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSaved(json.dependent);
      onOpenChange(false);
      toast.success(editing ? "Carga actualizada" : "Carga agregada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar carga de familia" : "Agregar carga de familia"}
          </DialogTitle>
          <DialogDescription>
            Declará un familiar a cargo para deducir en SiRADIG.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* Parentesco */}
          <div className="space-y-1.5">
            <Label>Parentesco</Label>
            <Controller
              control={form.control}
              name="parentesco"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENTESCO_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Documento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo documento</Label>
              <Controller
                control={form.control}
                name="tipoDoc"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_DOC_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Nro. documento</Label>
              <Input {...form.register("numeroDoc")} placeholder="Nro. documento" />
              {form.formState.errors.numeroDoc && (
                <p className="text-xs text-destructive">{form.formState.errors.numeroDoc.message}</p>
              )}
            </div>
          </div>

          {/* Apellido / Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input {...form.register("apellido")} placeholder="Apellido" />
              {form.formState.errors.apellido && (
                <p className="text-xs text-destructive">{form.formState.errors.apellido.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input {...form.register("nombre")} placeholder="Nombre" />
              {form.formState.errors.nombre && (
                <p className="text-xs text-destructive">{form.formState.errors.nombre.message}</p>
              )}
            </div>
          </div>

          {/* Fecha nacimiento */}
          <div className="space-y-1.5">
            <Label>Fecha de nacimiento <span className="text-muted-foreground/50 text-xs font-normal">(opcional)</span></Label>
            <Input
              {...form.register("fechaNacimiento")}
              placeholder="dd/mm/aaaa"
              className="w-40"
            />
          </div>

          {/* Conditional: fecha unión */}
          {isUnion && (
            <div className="space-y-1.5">
              <Label>{unionDateLabel(parentesco)}</Label>
              <Input
                {...form.register("fechaUnion")}
                placeholder="dd/mm/aaaa"
                className="w-40"
              />
            </div>
          )}

          {/* Conditional: porcentaje deducción */}
          {isHijo && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Porcentaje de deducción</Label>
                <Controller
                  control={form.control}
                  name="porcentajeDed"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100%</SelectItem>
                        <SelectItem value="50">50% (ambos padres deducen)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {porcentajeDed === "50" && (
                <div className="space-y-1.5">
                  <Label>CUIL/CUIT del otro padre que también deduce</Label>
                  <Input
                    {...form.register("cuitOtroDed")}
                    placeholder="XX-XXXXXXXX-X"
                    className="w-44"
                  />
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border" />

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="familiaCargo">¿Está a cargo?</Label>
              </div>
              <Controller
                control={form.control}
                name="familiaCargo"
                render={({ field }) => (
                  <Switch id="familiaCargo" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="residente">¿Residente en el país?</Label>
              </div>
              <Controller
                control={form.control}
                name="residente"
                render={({ field }) => (
                  <Switch id="residente" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="tieneIngresos">¿Obtuvo ingresos en el período?</Label>
              </div>
              <Controller
                control={form.control}
                name="tieneIngresos"
                render={({ field }) => (
                  <Switch id="tieneIngresos" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {tieneIngresos && (
              <div className="space-y-1.5">
                <Label>Monto anual de ingresos</Label>
                <Input
                  {...form.register("montoIngresos")}
                  placeholder="0.00"
                  className="w-40"
                />
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Período */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mes desde</Label>
                <Controller
                  control={form.control}
                  name="mesDesde"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{mes}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mes hasta</Label>
                <Controller
                  control={form.control}
                  name="mesHasta"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{mes}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {mesHasta === 12 && (
              <div className="flex items-center justify-between">
                <Label htmlFor="proximosPeriodos" className="text-xs text-muted-foreground/80">
                  Vigente para los próximos períodos fiscales
                </Label>
                <Controller
                  control={form.control}
                  name="proximosPeriodos"
                  render={({ field }) => (
                    <Switch id="proximosPeriodos" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main section ─────────────────────────────────────────────────

export function FamilyDependentsSection({ fiscalYear }: { fiscalYear: number }) {
  const [dependents, setDependents] = useState<FamilyDependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyDependent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cargas-familia?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setDependents(d.dependents ?? []))
      .catch(() => toast.error("Error al cargar las cargas de familia"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(dep: FamilyDependent) {
    setEditing(dep);
    setDialogOpen(true);
  }

  function handleSaved(dep: FamilyDependent) {
    setDependents((prev) => {
      const idx = prev.findIndex((d) => d.id === dep.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = dep;
        return next;
      }
      return [...prev, dep];
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/cargas-familia/${deleteId}`, { method: "DELETE" });
      setDependents((prev) => prev.filter((d) => d.id !== deleteId));
      toast.success("Carga eliminada");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
        </div>
      ) : dependents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground/60">
            No declaraste cargas de familia todavía.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dependents.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-muted/20"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {dep.apellido}, {dep.nombre}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {parentescoLabel(dep.parentesco)} · {dep.tipoDoc} {dep.numeroDoc}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(dep)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(dep.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={openAdd}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Agregar carga de familia
      </Button>

      <DependentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={handleSaved}
        fiscalYear={fiscalYear}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar carga de familia</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará esta carga de familia. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
