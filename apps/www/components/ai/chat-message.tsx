"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import type { ComponentProps } from "react";
import { memo } from "react";
import { AIChatMessageActions } from "./chat-actions";
import { AIChatLoading } from "./chat-loading";
import { AiMessagePart } from "./message-part";

interface Props {
  message: MyUIMessage;
  showActions?: ComponentProps<typeof AIChatMessageActions>["showActions"];
}

export const AiChatMessage = memo(({ message, showActions }: Props) => {
  // We are not showing the reasoning parts in the chat message, and not include step-start
  const parts = message.parts.filter((p) => p.type !== "step-start");

  if (parts.length === 0) {
    return <AIChatLoading force />;
  }

  return (
    <div className="flex size-full flex-col gap-2 group-[.is-user]:items-end group-[.is-user]:justify-end">
      <div className="flex flex-col gap-4">
        {parts.map((part, i) => (
          <AiMessagePart
            key={`part-${part.type}-${i}`}
            messageId={message.id}
            part={part}
            partIndex={i}
          />
        ))}
      </div>

      <AIChatMessageActions
        messageId={message.id}
        showActions={showActions}
        text={parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")}
      />
    </div>
  );
});

AiChatMessage.displayName = "AiChatMessage";
