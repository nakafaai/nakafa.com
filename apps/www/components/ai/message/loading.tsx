"use client";

import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { isToolUIPart } from "ai";

import { useChat } from "@/components/ai/chat/context";
import { useMessage } from "@/components/ai/message/context";

export function AiChatMessageLoading() {
  const busy = useChat((state) => state.busy);
  const messages = useChat((state) => state.messages);
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
  if (busy && currentMessage.status !== "failed") {
    const hasContent = currentMessage.parts.some(
      (p) =>
        isToolUIPart(p) ||
        ((p.type === "text" || p.type === "reasoning") &&
          p.text.trim().length > 0)
    );

    if (!hasContent) {
      return (
        <div className="flex flex-col gap-6">
          <TypingLoader />
        </div>
      );
    }
  }

  return null;
}
AiChatMessageLoading.displayName = "AiChatMessageLoading";
