import { AutomationDashboard } from "@/components/automatizacion/automation-dashboard";

export default function AutomatizacionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Automatizacion</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona la carga automatica de tus deducciones en SiRADIG
        </p>
      </div>
      <AutomationDashboard />
    </div>
  );
}
