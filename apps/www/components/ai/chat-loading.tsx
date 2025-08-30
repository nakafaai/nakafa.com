import { Message } from "@repo/design-system/components/ai/message";
import { TypingLoader } from "@repo/design-system/components/ui/icons";
import type { ChatStatus } from "ai";
import { memo } from "react";

type Props = {
  status: ChatStatus;
  force?: boolean;
};

export const AIChatLoading = memo(({ status, force = false }: Props) => {
  if (status !== "submitted" && !force) {
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
