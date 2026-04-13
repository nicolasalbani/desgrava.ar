"use client";

import { useState, useCallback, useRef } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ImagePlus, Loader2 } from "lucide-react";

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => Promise<void>;
}

/** Crop the selected area from the image and return a 256×256 JPEG data URL. */
async function getCroppedImage(imageSrc: string, crop: Area): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
  });

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 256, 256);

  return canvas.toDataURL("image/jpeg", 0.8);
}

export function AvatarCropDialog({ open, onOpenChange, onSave }: AvatarCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, croppedArea);
      await onSave(dataUrl);
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar foto de perfil</DialogTitle>
        </DialogHeader>

        {!imageSrc ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-muted hover:bg-muted/80 flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-full transition-colors"
            >
              <ImagePlus className="text-muted-foreground h-8 w-8" />
              <span className="text-muted-foreground text-xs">Elegir imagen</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <>
            <div className="relative h-64 w-full sm:h-72">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3 px-1">
              <span className="text-muted-foreground text-xs">Zoom</span>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.05}
                onValueChange={(v) => setZoom(v[0])}
                className="flex-1"
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          {imageSrc && (
            <Button onClick={handleSave} disabled={saving || !croppedArea}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
