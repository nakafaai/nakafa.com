import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/icons";
import type { ChatStatus } from "ai";
import { memo } from "react";

export const AIChatLoading = memo(({ status }: { status: ChatStatus }) => {
  if (status !== "submitted") {
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
