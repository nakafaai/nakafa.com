"use client";

import { ChatComposer } from "@/components/ai/chat/composer";
import { useChat } from "@/components/ai/chat/context";
import { AiChatHeader } from "@/components/ai/chat/header";
import { NinaTranscript } from "@/components/ai/transcript";

export function AiChat() {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <AiChatHeader />

      <NinaTranscript />

      <AiChatToolbar />
    </div>
  );
}

/** Only the conversation owner can continue it. */
function AiChatToolbar() {
  const canWrite = useChat((state) => state.canWrite);

  if (!canWrite) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl shrink-0 px-4 pb-4">
      <ChatComposer />
    </div>
  );
}
AiChatToolbar.displayName = "AIChatToolbar";
