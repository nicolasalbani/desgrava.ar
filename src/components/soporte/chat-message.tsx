"use client";

import { cn } from "@/lib/utils";
import type { SupportEvent } from "@/lib/soporte/types";
import { MessageCircle, ExternalLink } from "lucide-react";

/** Render simple markdown: **bold**, *italic*, `code`, bullet lists, and line breaks. */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-1 list-inside list-disc space-y-0.5 pl-1">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  }

  function formatInline(line: string, key: string | number): React.ReactNode {
    // Split by **bold**, *italic*, and `code` patterns
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${key}-${i}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={`${key}-${i}`} className="bg-foreground/10 rounded px-1 py-0.5 text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[\s]*[-•]\s+(.*)/);
    if (bulletMatch) {
      listItems.push(<li key={`li-${i}`}>{formatInline(bulletMatch[1], `li-${i}`)}</li>);
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<br key={`br-${i}`} />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="my-0">
            {formatInline(line, `p-${i}`)}
          </p>,
        );
      }
    }
  }
  flushList();

  return elements;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  events?: SupportEvent[];
}

export function ChatMessage({ role, content, events }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
          <MessageCircle className="size-3.5" />
        </div>
      )}
      <div className="flex max-w-[85%] flex-col gap-2">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md",
          )}
        >
          {isUser ? content : renderMarkdown(content)}
        </div>

        {events?.map((event) => {
          if (event.type === "ticket_created") {
            return (
              <div
                key={event.ticketId}
                className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
              >
                <span className="font-medium">Ticket #{event.ticketId.slice(-6)} creado</span>
              </div>
            );
          }
          if (event.type === "whatsapp_offer" && event.whatsappUrl) {
            return (
              <a
                key="whatsapp"
                href={event.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.506 3.932 1.395 5.608L0 24l6.563-1.361C8.148 23.52 10.03 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.82 0-3.543-.468-5.043-1.29l-.36-.214-3.75.778.813-3.65-.234-.372A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
                Contactar por WhatsApp
                <ExternalLink className="size-3" />
              </a>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
