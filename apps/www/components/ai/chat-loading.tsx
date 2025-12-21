import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/icons";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

interface Props {
  force?: boolean;
}

export const AIChatLoading = memo(({ force = false }: Props) => {
  const status = useChat((state) => state.chat.status);

  if (status && status !== "submitted" && !force) {
    return null;
  }

  return (
    <Message from="assistant" key="typing">
      <div className="flex flex-col gap-4">
        <TypingLoader />
      </div>
    </Message>
  );
});
AIChatLoading.displayName = "AIChatLoading";
