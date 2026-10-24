import type { ReactNode } from "react";
import { ChatComposer } from "@/components/ai/chat/composer";
import { AiChatHeader } from "@/components/ai/chat/header";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * A chat's page: its header, its transcript, and the composer under them. A
 * reader's page passes its own `footer` in the composer's place, since a reader
 * cannot write to the chat.
 */
export function AiChat({ footer }: { footer?: ReactNode }) {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <AiChatHeader />

      <NinaTranscript />

      {footer ?? (
        <ChatComposer className="mx-auto w-full max-w-3xl px-4 pb-4" />
      )}
    </div>
  );
}
