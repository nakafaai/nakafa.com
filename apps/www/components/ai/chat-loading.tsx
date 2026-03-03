import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

export const AiChatLoading = memo(() => {
  const status = useChat((state) => state.chat.status);
  const messages = useChat((state) => state.chat.messages);

  // Not loading
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }

  const lastMessage = messages.at(-1);

  // Case 1: Submitted - no assistant message exists yet
  if (status === "submitted" && lastMessage?.role !== "assistant") {
    return (
      <Message from="assistant">
        <div className="flex flex-col gap-6">
          <TypingLoader />
        </div>
      </Message>
    );
  }

  // Case 2: Streaming - assistant exists but no text content yet
  if (status === "streaming" && lastMessage?.role === "assistant") {
    const hasText = lastMessage.parts.some(
      (p) => p.type === "text" && p.text.trim().length > 0
    );

    if (!hasText) {
      return (
        <Message from="assistant">
          <div className="flex flex-col gap-6">
            <TypingLoader />
          </div>
        </Message>
      );
    }
  }

  return null;
});
AiChatLoading.displayName = "AiChatLoading";
