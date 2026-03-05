"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu } from "lucide-react";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { useState } from "react";

export function DashboardHeader() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center gap-4 border-b border-border bg-background py-4 px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <DashboardMobileNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      {session?.user && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground hidden sm:block">
            {session.user.name}
          </span>
          <Avatar className="h-9 w-9 ring-2 ring-border">
            <AvatarImage src={session.user.image ?? undefined} />
            <AvatarFallback>
              {session.user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </header>
  );
}
