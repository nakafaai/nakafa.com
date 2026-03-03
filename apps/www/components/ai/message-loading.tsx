"use client";

import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";
import { useMessage } from "./message-context";

export const AiChatMessageLoading = memo(() => {
  const status = useChat((state) => state.chat.status);
  const messages = useChat((state) => state.chat.messages);
  const currentMessage = useMessage((state) => state.message);

  // Only show loading for assistant messages
  if (currentMessage.role !== "assistant") {
    return null;
  }

  const isLastMessage = messages.at(-1)?.id === currentMessage.id;

  // Only show for the last assistant message
  if (!isLastMessage) {
    return null;
  }

  // Show loading when streaming but no text content yet
  if (status === "streaming") {
    const hasText = currentMessage.parts.some(
      (p) => p.type === "text" && p.text.trim().length > 0
    );

    if (!hasText) {
      return (
        <div className="flex flex-col gap-6">
          <TypingLoader />
        </div>
      );
    }
  }

  return null;
});
AiChatMessageLoading.displayName = "AiChatMessageLoading";
