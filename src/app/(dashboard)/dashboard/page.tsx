import { FileText, Bot, KeyRound, Calculator } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const quickActions = [
  {
    title: "Credenciales ARCA",
    description: "Configura tu CUIT y clave fiscal para automatizar",
    icon: KeyRound,
    href: "/credenciales",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    step: 1,
  },
  {
    title: "Cargar factura",
    description: "Agrega facturas manualmente o subi un PDF",
    icon: FileText,
    href: "/facturas/nueva",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    step: 2,
  },
  {
    title: "Automatizar carga",
    description: "Envia tus facturas a SiRADIG automaticamente",
    icon: Bot,
    href: "/automatizacion",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    step: 3,
  },
  {
    title: "Simulador",
    description: "Calcula tu ahorro en ganancias",
    icon: Calculator,
    href: "/simulador",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    step: 4,
  },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuario";

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {firstName}
        </h1>
        <p className="text-base text-gray-500 mt-1">
          Gestiona tus deducciones y automatiza la carga en SiRADIG
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="h-full">
              <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-full min-h-[180px] flex flex-col hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-400 flex items-center justify-center">
                  {action.step}
                </span>
                <div
                  className={`w-12 h-12 rounded-lg ${action.iconBg} flex items-center justify-center mb-4`}
                >
                  <Icon className={`h-6 w-6 ${action.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
