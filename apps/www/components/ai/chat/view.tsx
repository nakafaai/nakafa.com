"use client";

import { ChatComposer } from "@/components/ai/chat/composer";
import { AiChatHeader } from "@/components/ai/chat/header";
import { NinaTranscript } from "@/components/ai/transcript";

export function AiChat() {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <AiChatHeader />

      <NinaTranscript />

      <ChatComposer className="mx-auto w-full max-w-3xl px-4 pb-4" />
    </div>
  );
}
