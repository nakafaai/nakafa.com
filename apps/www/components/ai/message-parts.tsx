"use client";

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
          // biome-ignore lint/suspicious/noArrayIndexKey: AI SDK 7.0.77 appends parts in place; text parts expose no id. https://github.com/vercel/ai/blob/ai%407.0.77/packages/ai/src/ui/process-ui-message-stream.ts#L427-L438
          key={`part-${part.type}-${i}`}
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
