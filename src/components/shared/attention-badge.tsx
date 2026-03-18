"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AttentionBadgeProps {
  count: number;
  href: string;
  onClick?: () => void;
}

export function AttentionBadge({ count, href, onClick }: AttentionBadgeProps) {
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
        "ml-auto flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full px-1.5",
        "bg-red-500 text-[11px] leading-none font-semibold text-white",
        "animate-in fade-in zoom-in-75 transition-all duration-300",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
