import type { ReactNode } from "react";
import { ChatComposer } from "@/components/ai/chat/composer";
import { AiChatHeader } from "@/components/ai/chat/header";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * A chat's page in the forum's composition: its header, its transcript as wide
 * as the page's column with each message at a readable measure, and the
 * composer under them as wide as the transcript. A reader's page passes its own
 * `footer` in the composer's place, since a reader cannot write to the chat.
 */
export function AiChat({ footer }: { footer?: ReactNode }) {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <AiChatHeader />

      <NinaTranscript />

      {footer ?? (
        <ChatComposer className="mx-auto w-full max-w-7xl px-4 pb-4" />
      )}
    </div>
  );
}
