"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { memo } from "react";
import { AIChatMessageActions } from "./chat-actions";
import { AiMessagePart } from "./message-part";

interface Props {
  message: MyUIMessage;
}

export const AiChatMessage = memo(({ message }: Props) => {
  // We are not showing the reasoning parts in the chat message, and not include step-start
  const parts = message.parts.filter((p) => p.type !== "step-start");

  return (
    <div className="flex size-full flex-col gap-3 group-[.is-user]:items-end group-[.is-user]:justify-end">
      <div className="flex flex-col gap-6">
        {parts.map((part, i) => (
          <AiMessagePart
            // biome-ignore lint/suspicious/noArrayIndexKey: Part type may not be unique, need index for stability
            key={`part-${part.type}-${i}`}
            messageId={message.id}
            part={part}
            partIndex={i}
          />
        ))}
      </div>

      <AIChatMessageActions
        messageId={message.id}
        role={message.role}
        text={parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")}
      />
    </div>
  );
});

AiChatMessage.displayName = "AiChatMessage";
