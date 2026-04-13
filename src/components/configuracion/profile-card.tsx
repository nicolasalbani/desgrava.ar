"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Lock } from "lucide-react";
import { toast } from "sonner";
import { AvatarCropDialog } from "./avatar-crop-dialog";

interface ProfileCardProps {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function ProfileCard({ name: initialName, email, image: initialImage }: ProfileCardProps) {
  const { update: updateSession } = useSession();
  const [name, setName] = useState(initialName ?? "");
  const [image, setImage] = useState(initialImage);
  const [cropOpen, setCropOpen] = useState(false);
  const previousName = useRef(initialName ?? "");

  async function saveName(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === previousName.current) return;

    try {
      const res = await fetch("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      previousName.current = trimmed;
      setName(trimmed);
      await updateSession();
      toast.success("Nombre actualizado");
    } catch {
      setName(previousName.current);
      toast.error("Error al guardar el nombre");
    }
  }

  async function saveImage(dataUrl: string) {
    const res = await fetch("/api/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) throw new Error("Error al guardar la imagen");
    setImage(dataUrl);
    await updateSession();
    toast.success("Foto de perfil actualizada");
  }

  const initials = name?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <>
      <div className="space-y-2">
        <Label>Mi perfil</Label>
        <p className="text-muted-foreground/60 text-xs">Tu información personal en desgrava.ar</p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Avatar with edit overlay */}
        <button
          type="button"
          onClick={() => setCropOpen(true)}
          className="group relative shrink-0"
          aria-label="Cambiar foto de perfil"
        >
          <Avatar className="ring-border h-24 w-24 ring-2">
            <AvatarImage src={image ?? undefined} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="bg-foreground/60 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Name + Email fields */}
        <div className="w-full min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-muted-foreground text-xs">
              Nombre completo
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => saveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Tu nombre"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground flex items-center gap-1 text-xs">
              Email
              <Lock className="h-3 w-3 opacity-50" />
            </Label>
            <p className="text-foreground truncate text-sm">{email}</p>
          </div>
        </div>
      </div>

      <AvatarCropDialog open={cropOpen} onOpenChange={setCropOpen} onSave={saveImage} />
    </>
  );
}
