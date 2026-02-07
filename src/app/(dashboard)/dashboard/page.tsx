import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Bot, KeyRound, Calculator } from "lucide-react";
import Link from "next/link";

const quickActions = [
  {
    title: "Credenciales ARCA",
    description: "Configura tu CUIT y clave fiscal",
    icon: KeyRound,
    href: "/credenciales",
  },
  {
    title: "Cargar factura",
    description: "Agrega facturas manualmente o subi un PDF",
    icon: FileText,
    href: "/facturas/nueva",
  },
  {
    title: "Automatizar carga",
    description: "Envia tus facturas a SiRADIG automaticamente",
    icon: Bot,
    href: "/automatizacion",
  },
  {
    title: "Simulador",
    description: "Calcula tu ahorro en ganancias",
    icon: Calculator,
    href: "/simulador",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Panel</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus deducciones y automatiza la carga en SiRADIG
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <Icon className="h-8 w-8 text-muted-foreground mb-2" />
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{action.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
