"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import {
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";
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
import { NinaPrompt } from "@/components/ai/prompt";

interface Props {
  message: NinaMessage;
}

export function AiChatMessage({ message }: Props) {
  if (message.role === "user") {
    return (
      <MessageProvider message={message}>
        <NinaPrompt
          files={message.parts.filter((part) => part.type === "file")}
          id={message.id}
          text={message.text}
        >
          <AiChatMessageActions />
        </NinaPrompt>
      </MessageProvider>
    );
  }
  return (
    <MessageProvider message={message}>
      <AiChatMessageBody />
    </MessageProvider>
  );
}

AiChatMessage.displayName = "AiChatMessage";

function AiChatMessageBody() {
  const status = useMessage((state) => state.turn?.state.status);
  const settled =
    status === "complete" || status === "cancelled" || status === "failed";

  return (
    <MessageContent className="gap-4">
      <AiChatMessageContent />
      {status === "failed" ? <AiChatPersistedError /> : null}
      {settled ? (
        <MessageFooter className="min-h-9 justify-between gap-4">
          <AiChatMessageActions />
          <AiChatMessageCredits />
        </MessageFooter>
      ) : null}
      <AiChatMessageSuggestions />
    </MessageContent>
  );
}
AiChatMessageBody.displayName = "AiChatMessageBody";
