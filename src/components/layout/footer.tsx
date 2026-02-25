import { Calculator } from "lucide-react";
export function Footer() {
  return (
    <footer className="border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-8 px-4 md:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Calculator className="h-4 w-4 shrink-0" />
          <span>desgrava.ar</span>
        </div>
<p className="text-sm text-gray-400">
          {new Date().getFullYear()} desgrava.ar. No afiliado a ARCA/AFIP.
        </p>
      </div>
    </footer>
  );
}
