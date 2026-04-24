"use client";

import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { memo } from "react";
import { useChat } from "@/components/ai/context/use-chat";

export const AiChatPending = memo(() => {
  const status = useChat((state) => state.chat.status);
  const messages = useChat((state) => state.chat.messages);

  // Only show when submitted and no assistant message exists yet
  if (status !== "submitted") {
    return null;
  }

  const lastMessage = messages.at(-1);

  // If last message is already assistant, don't show pending
  if (lastMessage?.role === "assistant") {
    return null;
  }

  return (
    <Message from="assistant">
      <div className="flex flex-col gap-6">
        <TypingLoader />
      </div>
    </Message>
  );
});
AiChatPending.displayName = "AiChatPending";
