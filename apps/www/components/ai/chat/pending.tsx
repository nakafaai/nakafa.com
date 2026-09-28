"use client";

import { Message } from "@repo/design-system/components/ui/message";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";

import { useChat } from "@/components/ai/chat/context";

export function AiChatPending() {
  const busy = useChat((state) => state.busy);
  const turn = useChat((state) => state.turn);
  const messages = useChat((state) => state.messages);

  // Only show when submitted and no assistant message exists yet
  if (!busy) {
    return null;
  }

  const lastMessage = messages.at(-1);

  // If last message is already assistant, don't show pending
  if (lastMessage?.role === "assistant" && lastMessage.order === turn?.order) {
    return null;
  }

  return (
    <MessageScrollerItem messageId="pending">
      <Message>
        <TypingLoader />
      </Message>
    </MessageScrollerItem>
  );
}
AiChatPending.displayName = "AiChatPending";
