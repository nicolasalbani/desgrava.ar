"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import { SupportChatPanel } from "./support-chat-panel";

export function SupportChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SupportChatPanel open={open} onClose={() => setOpen(false)} />
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg sm:size-14"
          aria-label="Abrir chat de soporte"
        >
          <MessageCircleQuestion className="size-5 sm:size-6" />
        </Button>
      )}
    </>
  );
}
