"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import type { ChatStatus } from "ai";
import { memo } from "react";
import { AIChatMessageActions } from "./chat-actions";
import { AIChatLoading } from "./chat-loading";
import { AiMessagePart } from "./message-part";

type Props = {
  message: MyUIMessage;
  regenerate: ({ messageId }: { messageId: string }) => void;
  status: ChatStatus;
};

export const AiChatMessage = memo(({ message, regenerate, status }: Props) => {
  // We are not showing the reasoning parts in the chat message, and not include step-start
  const parts = message.parts.filter((p) => p.type !== "step-start");

  if (parts.length === 0) {
    return <AIChatLoading force status={status} />;
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
        regenerate={regenerate}
        text={parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")}
      />
    </div>
  );
});

AiChatMessage.displayName = "AiChatMessage";
