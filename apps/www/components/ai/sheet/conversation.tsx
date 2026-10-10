"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ChatComposer } from "@/components/ai/chat/composer";
import { ChatProvider } from "@/components/ai/chat/context";
import { NinaTranscript } from "@/components/ai/transcript";

/** Renders one chat's messages and its input inside Nina's sheet. */
export function SheetConversation({ chatId }: { chatId: Id<"chats"> }) {
  return (
    <ChatProvider chatId={chatId}>
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
        <NinaTranscript />

        <div className="grid shrink-0 px-2 pb-2">
          <ChatComposer autoFocus />
        </div>
      </div>
    </ChatProvider>
  );
}
