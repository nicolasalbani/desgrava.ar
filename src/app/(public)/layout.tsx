import { Navbar } from "@/components/layout/navbar";
import { LandingFooter } from "@/components/layout/landing-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
