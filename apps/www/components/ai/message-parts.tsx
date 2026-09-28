"use client";

import { isToolUIPart } from "ai";
import { useChat } from "@/components/ai/context/use-chat";
import { useMessage } from "@/components/ai/context/use-message";
import { AiChatMessageLoading } from "@/components/ai/message-loading";
import { AiMessagePart } from "@/components/ai/message-part/part";
import { SuggestionsPart } from "@/components/ai/message-part/suggestions";
import { useViewer } from "@/lib/identity/client";

export function AiChatMessageContent() {
  const parts = useMessage((state) =>
    state.message.parts.filter((p) => p.type !== "step-start")
  );

  return (
    <div className="flex flex-col gap-6 empty:hidden">
      {parts.map((part, i) => (
        <AiMessagePart
          // Agent appends text parts without IDs; tool invocations retain their native identity.
          key={isToolUIPart(part) ? part.toolCallId : `part-${part.type}-${i}`}
          part={part}
          partIndex={i}
        />
      ))}
      <AiChatMessageLoading />
    </div>
  );
}
AiChatMessageContent.displayName = "AiChatMessageContent";

export function AiChatMessageSuggestions() {
  const chat = useChat((s) => s.chat);

  const currentUser = useViewer((s) => s.account);
  const showSuggestions = chat?.userId === currentUser?.appUser._id;
  const suggestions = useMessage((state) =>
    state.message.role === "assistant" &&
    state.turn?.state.status === "complete"
      ? state.turn.suggestions
      : undefined
  );

  if (!(showSuggestions && suggestions)) {
    return null;
  }

  return <SuggestionsPart suggestions={suggestions} />;
}
AiChatMessageSuggestions.displayName = "AiChatMessageSuggestions";
