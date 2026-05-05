"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, MessageSquare, Ticket } from "lucide-react";
import type { ConversationSummary } from "@/lib/soporte/types";

interface ConversationsListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const RTF = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / (1000 * 60));
  const diffHr = Math.round(diffMs / (1000 * 60 * 60));
  const diffDay = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffMin) < 60) return RTF.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, "hour");
  if (Math.abs(diffDay) < 7) return RTF.format(diffDay, "day");
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function ConversationsList({
  conversations,
  loading,
  activeConversationId,
  onSelect,
  onNew,
}: ConversationsListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Button
          onClick={onNew}
          variant="outline"
          size="sm"
          className="min-h-[44px] w-full justify-start gap-2"
        >
          <Plus className="size-4" />
          Nueva conversación
        </Button>
      </div>

      <ScrollArea className="h-[400px] flex-1">
        {loading && conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
            <MessageSquare className="size-6 opacity-50" />
            <span>Todavía no tenés conversaciones.</span>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {conversations.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className={
                      "hover:bg-accent dark:hover:bg-accent/50 flex min-h-[44px] w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors " +
                      (isActive ? "bg-accent/60 dark:bg-accent/30" : "")
                    }
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {c.title ?? "Conversación sin título"}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatRelativeDate(c.lastMessageAt)}
                      </span>
                    </div>
                    {c.preview && (
                      <span className="text-muted-foreground line-clamp-1 text-xs">
                        {c.preview}
                      </span>
                    )}
                    {c.hasTicket && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        <Ticket className="size-3" />
                        Ticket abierto
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
