"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ConversationsList } from "./conversations-list";
import { GanancioAvatar } from "./ganancio-avatar";
import { X, Loader2, List, Plus, ArrowLeft } from "lucide-react";
import type { useConversation } from "@/hooks/use-conversation";

interface SupportChatPanelProps {
  open: boolean;
  onClose: () => void;
  conversation: ReturnType<typeof useConversation>;
}

export function buildGreeting(name: string | null | undefined): string {
  const firstName = name?.trim().split(/\s+/)[0];
  if (firstName) {
    return `Hola ${firstName}, soy Ganancio, tu asistente de desgrava.ar. ¿En qué puedo ayudarte?`;
  }
  return "Hola, soy Ganancio, tu asistente de desgrava.ar. ¿En qué puedo ayudarte?";
}

export function SupportChatPanel({ open, onClose, conversation }: SupportChatPanelProps) {
  const { data: session } = useSession();
  const greeting = buildGreeting(session?.user?.name);

  const {
    conversationId,
    messages,
    conversations,
    conversationsLoading,
    isSending,
    isLoadingConversation,
    send,
    startNewConversation,
    loadConversation,
  } = conversation;

  const [view, setView] = useState<"chat" | "list">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (view === "chat") scrollToBottom();
  }, [messages, isSending, view, scrollToBottom]);

  // When the panel reopens, default to the chat view (preserves the active conversation)
  useEffect(() => {
    if (open) setView("chat");
  }, [open]);

  function handleSelectConversation(id: string) {
    loadConversation(id);
    setView("chat");
  }

  function handleNewConversation() {
    startNewConversation();
    setView("chat");
  }

  if (!open) return null;

  const showGreeting = messages.length === 0 && !isLoadingConversation;

  return (
    <div className="bg-background fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border shadow-xl sm:w-[400px]">
      {/* Header */}
      <div className="bg-primary text-primary-foreground flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {view === "list" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("chat")}
              className="text-primary-foreground hover:bg-primary-foreground/20 size-8 shrink-0 p-0"
              aria-label="Volver al chat"
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className="text-primary-foreground hover:bg-primary-foreground/20 size-8 shrink-0 p-0"
              aria-label="Ver conversaciones"
            >
              <List className="size-4" />
            </Button>
          )}
          <span className="truncate text-sm font-medium">
            {view === "list" ? "Conversaciones" : "Soporte"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {view === "chat" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConversation}
              className="text-primary-foreground hover:bg-primary-foreground/20 size-8 shrink-0 p-0"
              aria-label="Nueva conversación"
            >
              <Plus className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-primary-foreground hover:bg-primary-foreground/20 size-8 shrink-0 p-0"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <ConversationsList
          conversations={conversations}
          loading={conversationsLoading}
          activeConversationId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      ) : (
        <>
          <ScrollArea ref={scrollRef} className="h-[400px]">
            <div className="flex flex-col gap-3 p-4">
              {isLoadingConversation && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              )}
              {showGreeting && <ChatMessage role="assistant" content={greeting} />}
              {messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} events={msg.events} />
              ))}
              {isSending && (
                <div className="flex items-center gap-2">
                  <GanancioAvatar size="sm" />
                  <div className="bg-muted flex items-center gap-1 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    <span className="text-muted-foreground text-xs">
                      Ganancio está escribiendo...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <ChatInput onSend={send} disabled={isSending} />
          </div>
        </>
      )}
    </div>
  );
}
