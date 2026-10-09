"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Response } from "@repo/design-system/components/ai/response";
import {
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";
import { Array as Arr } from "effect";
import { useChat } from "@/components/ai/chat/context";
import { AiChatPersistedError } from "@/components/ai/chat/error";
import { AiChatMessageActions } from "@/components/ai/message/actions";
import {
  AiChatMessageContent,
  AiChatMessageSuggestions,
} from "@/components/ai/message/content";
import { MessageProvider, useMessage } from "@/components/ai/message/context";
import { AiChatMessageCredits } from "@/components/ai/message/credits";
import { AiChatMessageLoading } from "@/components/ai/message/loading";
import { NinaPrompt } from "@/components/ai/message/prompt";

interface Props {
  message: NinaMessage;
}

export function AiChatMessage({ message }: Props) {
  const latest = useChat((state) => state.turn);
  const turn = latest?.order === message.order ? latest : message.metadata;
  if (message.role === "user") {
    return (
      <MessageProvider message={message} turn={turn}>
        <NinaPrompt
          actions={<AiChatMessageActions />}
          files={Arr.filter(message.parts, (part) => part.type === "file")}
        >
          <Response id={message.id}>{message.text}</Response>
        </NinaPrompt>
      </MessageProvider>
    );
  }
  return (
    <MessageProvider message={message} turn={turn}>
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
    <MessageContent className="gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        <AiChatMessageContent />
        <AiChatMessageLoading />
        {status === "failed" ? <AiChatPersistedError /> : null}
        {settled ? (
          <MessageFooter className="min-h-9 justify-between gap-4">
            <AiChatMessageActions />
            <AiChatMessageCredits />
          </MessageFooter>
        ) : null}
      </div>
      <AiChatMessageSuggestions />
    </MessageContent>
  );
}
AiChatMessageBody.displayName = "AiChatMessageBody";
