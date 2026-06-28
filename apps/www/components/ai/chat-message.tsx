"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { AiChatPersistedError } from "@/components/ai/chat-error";

import {
  MessageProvider,
  useMessage,
} from "@/components/ai/context/use-message";
import { AiChatMessageActions } from "@/components/ai/message-actions";
import { AiChatMessageCredits } from "@/components/ai/message-credits";
import {
  AiChatMessageContent,
  AiChatMessageSuggestions,
} from "@/components/ai/message-parts";

interface Props {
  message: MyUIMessage;
}

export const AiChatMessage = ({ message }: Props) => (
  <MessageProvider message={message}>
    <div className="flex size-full flex-col gap-3 group-[.is-user]:items-end group-[.is-user]:justify-end">
      <AiChatMessageBody />
      <div className="flex items-center justify-between gap-4">
        <AiChatMessageActions />
        <AiChatMessageCredits />
      </div>
      <AiChatMessageSuggestions />
    </div>
  </MessageProvider>
);

AiChatMessage.displayName = "AiChatMessage";

const AiChatMessageBody = () => {
  const isFailedAssistantResponse = useMessage(
    (state) =>
      state.message.role === "assistant" &&
      state.message.metadata?.generationStatus === "failed"
  );

  if (isFailedAssistantResponse) {
    return <AiChatPersistedError />;
  }

  return <AiChatMessageContent />;
};
AiChatMessageBody.displayName = "AiChatMessageBody";
