"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AttentionBadgeProps {
  count: number;
  href: string;
  onClick?: () => void;
  variant?: "inline" | "compact";
}

export function AttentionBadge({ count, href, onClick, variant = "inline" }: AttentionBadgeProps) {
  const router = useRouter();

  if (count === 0) return null;

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
          router.push(href);
        }
      }}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full",
        "bg-red-500 leading-none font-semibold text-white",
        "animate-in fade-in zoom-in-75 transition-all duration-300",
        variant === "inline" && "ml-auto h-5 min-w-5 px-1.5 text-[11px]",
        variant === "compact" &&
          "ring-background absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] ring-2",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
