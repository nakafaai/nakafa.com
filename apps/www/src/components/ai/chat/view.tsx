import { cn } from "cn";
import type { ReactNode } from "react";
import { ChatComposer } from "@/components/ai/chat/composer";
import { AiChatHeader } from "@/components/ai/chat/header";
import { NinaTranscript } from "@/components/ai/transcript";
import { pageRowVariants } from "@/components/shared/content/width";

/**
 * A chat's page: its header, its transcript, and the composer under them. A
 * reader's page passes its own `footer` in the composer's place, since a reader
 * cannot write to the chat.
 */
export function AiChat({ footer }: { footer?: ReactNode }) {
  return (
    <div className="text-chat relative flex size-full min-w-0 flex-col overflow-hidden">
      <AiChatHeader />

      <NinaTranscript />

      {footer ?? <ChatComposer className={cn(pageRowVariants(), "pb-4")} />}
    </div>
  );
}
