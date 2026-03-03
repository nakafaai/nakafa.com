import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

export const AIChatLoading = memo(() => {
  const status = useChat((state) => state.chat.status);

  if (status === "streaming" || status === "submitted") {
    return (
      <Message from="assistant" key="typing">
        <div className="flex flex-col gap-4">
          <TypingLoader />
        </div>
      </Message>
    );
  }

  return null;
});
AIChatLoading.displayName = "AIChatLoading";
