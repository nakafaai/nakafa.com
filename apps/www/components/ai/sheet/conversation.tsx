"use client";

import { ChatComposer } from "@/components/ai/chat/composer";
import { ChatProvider } from "@/components/ai/chat/context";
import { useAi } from "@/components/ai/context";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * Renders the open chat's messages and its input inside Nina's sheet. The open
 * chat is read from the AI store. The provider gives each chat its own state,
 * so choosing another chat in the history shows none of the previous chat's
 * error or pending prompt.
 */
export function SheetConversation() {
  const chatId = useAi((state) => state.activeChatId);
  if (chatId === null) {
    return null;
  }

  return (
    <ChatProvider chatId={chatId} key={chatId}>
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
        <NinaTranscript />

        <ChatComposer autoFocus className="px-2 pb-2" />
      </div>
    </ChatProvider>
  );
}
