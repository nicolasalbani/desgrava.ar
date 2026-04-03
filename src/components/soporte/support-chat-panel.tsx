"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { X, MessageCircle, Loader2 } from "lucide-react";
import type { ChatMessage as ChatMessageType, SupportEvent } from "@/lib/soporte/types";

interface DisplayMessage extends ChatMessageType {
  events?: SupportEvent[];
}

interface SupportChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const GREETING = "¡Hola! Soy el asistente de soporte de desgrava.ar. ¿En qué puedo ayudarte?";

export function SupportChatPanel({ open, onClose }: SupportChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    // ScrollArea uses a viewport child — scroll that element
    const viewport = scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Reset chat when panel is closed
  useEffect(() => {
    if (!open) {
      setMessages([{ role: "assistant", content: GREETING }]);
      setIsLoading(false);
    }
  }, [open]);

  async function handleSend(text: string) {
    const userMessage: DisplayMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Find ticket ID from any previous message events
      const ticketEvent = updatedMessages
        .flatMap((m) => m.events ?? [])
        .find((e) => e.type === "ticket_created");
      const existingTicketId =
        ticketEvent?.type === "ticket_created" ? ticketEvent.ticketId : undefined;

      const res = await fetch("/api/soporte/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          pageUrl: window.location.pathname,
          ...(existingTicketId && { ticketId: existingTicketId }),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      const assistantMessage: DisplayMessage = {
        role: "assistant",
        content: data.content,
        events: data.events,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intentá de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="bg-background fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border shadow-xl sm:w-[400px]">
      {/* Header */}
      <div className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4" />
          <span className="text-sm font-medium">Soporte</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-primary-foreground hover:bg-primary-foreground/20 size-7 p-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="h-[400px]">
        <div className="flex flex-col gap-3 p-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} events={msg.events} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                <MessageCircle className="size-3.5" />
              </div>
              <div className="bg-muted flex items-center gap-1 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
                <span className="text-muted-foreground text-xs">Escribiendo...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
