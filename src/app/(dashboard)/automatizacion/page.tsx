import { AutomationDashboard } from "@/components/automatizacion/automation-dashboard";

export default function AutomatizacionPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Automatizacion
        </h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Carga automatica de deducciones en SiRADIG
        </p>
      </div>
      <AutomationDashboard />
    </div>
  );
}
