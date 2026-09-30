"use client";

import { Message } from "@repo/design-system/components/ui/message";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";

import { useChat } from "@/components/ai/chat/context";

export function AiChatPending() {
  const busy = useChat((state) => state.busy);
  const hasTurnResponse = useChat((state) => state.hasTurnResponse);

  // Only show while a turn runs and its reply has not started.
  if (!busy || hasTurnResponse) {
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
