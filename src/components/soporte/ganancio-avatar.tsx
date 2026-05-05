import Image from "next/image";
import { cn } from "@/lib/utils";

interface GanancioAvatarProps {
  size?: "sm" | "md";
  className?: string;
}

export function GanancioAvatar({ size = "sm", className }: GanancioAvatarProps) {
  const sizeClasses = size === "md" ? "size-9" : "size-7";
  const pixels = size === "md" ? 36 : 28;

  return (
    <div
      className={cn(
        "bg-primary/10 ring-primary/20 relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
        sizeClasses,
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/ganancio.png"
        alt=""
        width={pixels}
        height={pixels}
        className="size-full object-cover"
        priority={false}
      />
    </div>
  );
}
