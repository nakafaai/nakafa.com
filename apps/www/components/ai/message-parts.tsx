"use client";

import { memo } from "react";
import { useMessage } from "./message-context";
import { AiMessagePart } from "./message-part";
import { SuggestionsPart } from "./message-part/suggestions";

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
    </div>
  );
});
AiChatMessageContent.displayName = "AiChatMessageContent";

export const AiChatMessageSuggestions = memo(() => {
  const suggestions = useMessage((state) => {
    const part = state.message.parts.find((p) => p.type === "data-suggestions");
    return part?.type === "data-suggestions" ? part.data : null;
  });

  if (!suggestions) {
    return null;
  }

  return <SuggestionsPart message={suggestions} />;
});
AiChatMessageSuggestions.displayName = "AiChatMessageSuggestions";
