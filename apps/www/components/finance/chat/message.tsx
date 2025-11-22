"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import type { ComponentProps } from "react";
import { memo } from "react";
import { FinanceChatMessageActions } from "@/components/finance/chat/actions";
import { FinanceChatLoading } from "@/components/finance/chat/loading";
import { FinanceChatMessagePart } from "@/components/finance/chat/message-part";

type Props = {
  message: MyUIMessage;
  showActions?: ComponentProps<typeof FinanceChatMessageActions>["showActions"];
};

export const FinanceChatMessage = memo(({ message, showActions }: Props) => {
  // We are not showing the reasoning parts in the chat message, and not include step-start
  const parts = message.parts.filter((p) => p.type !== "step-start");

  if (parts.length === 0) {
    return <FinanceChatLoading force />;
  }

  return (
    <div className="flex size-full flex-col gap-2 group-[.is-user]:items-end group-[.is-user]:justify-end">
      <div className="flex flex-col gap-4">
        {parts.map((part, i) => (
          <FinanceChatMessagePart
            key={`part-${part.type}-${i}`}
            messageId={message.id}
            part={part}
            partIndex={i}
          />
        ))}
      </div>

      <FinanceChatMessageActions
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

FinanceChatMessage.displayName = "FinanceChatMessage";
