"use client";

import { useEffect, useId, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const HOLE_PADDING = 8;
const HOLE_RADIUS = 12;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 12;

interface SpotlightProps {
  selector: string;
  /** Fallback selector used when the primary selector is hidden (e.g. mobile sidebar). */
  fallbackSelector?: string;
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  onPrev?: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}

function findVisibleTarget(selector: string, fallback?: string): HTMLElement | null {
  const candidates = [selector, fallback].filter(Boolean) as string[];
  for (const sel of candidates) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(el).visibility !== "hidden" &&
        window.getComputedStyle(el).display !== "none";
      if (visible) return el;
    }
  }
  return null;
}

export function Spotlight({
  selector,
  fallbackSelector,
  title,
  body,
  stepIndex,
  totalSteps,
  onPrev,
  onNext,
  onSkip,
  isLast,
}: SpotlightProps) {
  const maskId = useId();
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const el = findVisibleTarget(selector, fallbackSelector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - HOLE_PADDING,
      left: r.left - HOLE_PADDING,
      width: r.width + HOLE_PADDING * 2,
      height: r.height + HOLE_PADDING * 2,
    });
  }, [selector, fallbackSelector]);

  // Auto-scroll target into view, then measure.
  useLayoutEffect(() => {
    const el = findVisibleTarget(selector, fallbackSelector);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Give the smooth scroll a moment to settle, then measure.
      const t = setTimeout(measure, 350);
      return () => clearTimeout(t);
    }
    measure();
  }, [selector, fallbackSelector, measure]);

  // Keep hole synced with target on resize/scroll/layout shift.
  useEffect(() => {
    let frame: number | null = null;
    const handler = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    let observer: ResizeObserver | null = null;
    const el = findVisibleTarget(selector, fallbackSelector);
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handler);
      observer.observe(el);
    }

    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
      if (observer) observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [selector, fallbackSelector, measure]);

  // Escape = skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onSkip]);

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!rect || typeof window === "undefined") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;

    if (isMobile) {
      // Anchor to bottom of viewport, full width with margins.
      return {
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: "calc(100vw - 2rem)",
      };
    }

    // Try to place to the right of the target; if no room, to the left; else below.
    const spaceRight = vw - (rect.left + rect.width);
    const spaceLeft = rect.left;

    if (spaceRight >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
      const top = Math.max(16, Math.min(rect.top, vh - 220));
      return { top, left: rect.left + rect.width + TOOLTIP_GAP, width: TOOLTIP_WIDTH };
    }
    if (spaceLeft >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
      const top = Math.max(16, Math.min(rect.top, vh - 220));
      return { top, left: rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP, width: TOOLTIP_WIDTH };
    }
    // Place below
    const top = rect.top + rect.height + TOOLTIP_GAP;
    return {
      top: Math.min(top, vh - 220),
      left: Math.max(16, Math.min(rect.left, vw - TOOLTIP_WIDTH - 16)),
      width: TOOLTIP_WIDTH,
    };
  }, [rect]);

  return (
    <div className="fixed inset-0 z-[60]" aria-hidden={false}>
      {/* SVG overlay with mask */}
      <svg
        className="pointer-events-auto absolute inset-0 h-full w-full"
        aria-hidden="true"
        onClick={(e) => {
          // Block clicks outside the hole — but allow tooltip itself.
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={HOLE_RADIUS}
                ry={HOLE_RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${maskId}-title`}
        aria-describedby={`${maskId}-body`}
        className={cn(
          "bg-card border-border pointer-events-auto absolute rounded-2xl border p-5 shadow-lg",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        style={tooltipStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id={`${maskId}-title`} className="text-foreground text-base font-semibold">
            {title}
          </h3>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Saltar tour"
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 flex h-8 min-h-[44px] w-8 min-w-[44px] items-center justify-center rounded-md sm:min-h-0 sm:min-w-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p id={`${maskId}-body`} className="text-muted-foreground mb-4 text-sm">
          {body}
        </p>

        {totalSteps > 1 && (
          <div className="mb-4 flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === stepIndex ? "bg-primary w-6" : "bg-muted w-1.5",
                )}
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-2",
            totalSteps > 1 ? "justify-between" : "justify-end",
          )}
        >
          {totalSteps > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              Saltar
            </Button>
          )}
          <div className="flex items-center gap-2">
            {onPrev && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPrev}
                aria-label="Anterior"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" size="sm" onClick={onNext}>
              {isLast ? "Listo" : "Siguiente"}
              {!isLast && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
