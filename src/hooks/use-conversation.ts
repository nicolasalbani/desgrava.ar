"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, ConversationSummary } from "@/lib/soporte/types";

interface UseConversationResult {
  conversationId: string | null;
  messages: ChatMessage[];
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  isSending: boolean;
  isLoadingConversation: boolean;
  send: (text: string) => Promise<void>;
  startNewConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

export function useConversation(initialOpen: boolean): UseConversationResult {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const refreshConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const res = await fetch("/api/soporte/conversaciones");
      if (!res.ok) return;
      const data = (await res.json()) as ConversationSummary[];
      setConversations(data);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialOpen) {
      refreshConversations();
    }
  }, [initialOpen, refreshConversations]);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingConversation(true);
    try {
      const res = await fetch(`/api/soporte/conversaciones/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { id: string; messages: ChatMessage[] };
      setConversationId(data.id);
      setMessages(data.messages);
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const optimistic: ChatMessage = { role: "user", content: text };
      const previousMessages = messages;
      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);

      try {
        const res = await fetch("/api/soporte/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId,
            pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to send message");
        }

        const data = (await res.json()) as {
          conversationId: string;
          content: string;
          events?: ChatMessage["events"];
        };

        setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.content,
            ...(data.events && data.events.length > 0 ? { events: data.events } : {}),
          },
        ]);
        // Refresh the list so the new/updated conversation appears at the top
        refreshConversations();
      } catch {
        // Roll back the optimistic user message and surface a soft error
        setMessages([
          ...previousMessages,
          optimistic,
          {
            role: "assistant",
            content:
              "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intentá de nuevo.",
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, messages, refreshConversations],
  );

  return {
    conversationId,
    messages,
    conversations,
    conversationsLoading,
    isSending,
    isLoadingConversation,
    send,
    startNewConversation,
    loadConversation,
    refreshConversations,
  };
}
