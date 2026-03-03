"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { memo } from "react";
import { AiChatMessageActions } from "./message-actions";
import { MessageProvider } from "./message-context";
import {
  AiChatMessageContent,
  AiChatMessageSuggestions,
} from "./message-parts";

interface Props {
  message: MyUIMessage;
}

export const AiChatMessage = memo(({ message }: Props) => {
  return (
    <MessageProvider message={message}>
      <div className="flex size-full flex-col gap-3 group-[.is-user]:items-end group-[.is-user]:justify-end">
        <AiChatMessageContent />
        <AiChatMessageActions />
        <AiChatMessageSuggestions />
      </div>
    </MessageProvider>
  );
});

AiChatMessage.displayName = "AiChatMessage";
