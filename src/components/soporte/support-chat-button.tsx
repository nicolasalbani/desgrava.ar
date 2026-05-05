"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import { SupportChatPanel } from "./support-chat-panel";
import { useConversation } from "@/hooks/use-conversation";

export function SupportChatButton() {
  const [open, setOpen] = useState(false);
  const conversation = useConversation(open);

  return (
    <>
      <SupportChatPanel open={open} onClose={() => setOpen(false)} conversation={conversation} />
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className="group fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl sm:size-14"
          aria-label="Abrir chat de soporte"
        >
          <MessageCircleQuestion className="size-5 transition-transform duration-300 ease-out group-hover:-rotate-12 sm:size-6" />
        </Button>
      )}
    </>
  );
}
