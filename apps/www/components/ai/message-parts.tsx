"use client";

import { memo } from "react";
import { useCurrentChat } from "@/components/ai/context/use-current-chat";
import { useMessage } from "@/components/ai/context/use-message";
import { AiChatMessageLoading } from "@/components/ai/message-loading";
import { AiMessagePart } from "@/components/ai/message-part";
import { SuggestionsPart } from "@/components/ai/message-part/suggestions";
import { useUser } from "@/lib/context/use-user";

export const AiChatMessageContent = memo(() => {
  const parts = useMessage((state) =>
    state.message.parts.filter(
      (p) => p.type !== "step-start" && p.type !== "data-suggestions"
    )
  );

  return (
    <div className="flex flex-col gap-6">
      {parts.map((part, i) => (
        <AiMessagePart
          // biome-ignore lint/suspicious/noArrayIndexKey: Part type may not be unique, need index for stability
          key={`part-${part.type}-${i}`}
          part={part}
          partIndex={i}
        />
      ))}
      <AiChatMessageLoading />
    </div>
  );
});
AiChatMessageContent.displayName = "AiChatMessageContent";

export const AiChatMessageSuggestions = memo(() => {
  const chat = useCurrentChat((s) => s.chat);

  const currentUser = useUser((s) => s.user);
  const showSuggestions = chat?.userId === currentUser?.appUser._id;
  const suggestions = useMessage((state) => {
    const part = state.message.parts.find((p) => p.type === "data-suggestions");
    return part?.type === "data-suggestions" ? part.data : null;
  });

  if (!(showSuggestions && suggestions)) {
    return null;
  }

  return <SuggestionsPart message={suggestions} />;
});
AiChatMessageSuggestions.displayName = "AiChatMessageSuggestions";
