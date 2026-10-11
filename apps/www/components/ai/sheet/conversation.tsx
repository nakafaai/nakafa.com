"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ChatComposer } from "@/components/ai/chat/composer";
import { ChatProvider } from "@/components/ai/chat/context";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * Renders one chat's messages and its input inside Nina's sheet. Each chat
 * gets its own provider, so choosing another chat in the history starts with
 * none of the previous chat's error, stop, send or pending prompt. The text
 * the learner is typing stays, as it does between pages.
 */
export function SheetConversation({ chatId }: { chatId: Id<"chats"> }) {
  return (
    <ChatProvider chatId={chatId} key={chatId}>
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
        <NinaTranscript />

        <ChatComposer autoFocus className="px-2 pb-2" />
      </div>
    </ChatProvider>
  );
}
