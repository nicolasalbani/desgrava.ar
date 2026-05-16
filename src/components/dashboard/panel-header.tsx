interface PanelHeaderProps {
  firstName: string;
  fiscalYear: number;
}

export function PanelHeader({ firstName, fiscalYear }: PanelHeaderProps) {
  return (
    <div className="animate-in fade-in duration-500" style={{ animationFillMode: "backwards" }}>
      <p className="text-muted-foreground text-sm">
        Hola, {firstName} <span aria-hidden="true">👋</span>
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        Resumen de deducciones — Año fiscal {fiscalYear}
      </h1>
    </div>
  );
}
