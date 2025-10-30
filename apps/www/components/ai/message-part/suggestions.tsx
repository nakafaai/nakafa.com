"use client";

import type { DataPart } from "@repo/ai/types/data-parts";
import { PlusIcon, QuoteIcon } from "lucide-react";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

type Props = {
  message: DataPart["suggestions"];
};

export const SuggestionsPart = memo(({ message }: Props) => {
  const suggestions = message.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <QuoteIcon className="size-4" />
        <span>Related</span>
      </div>
      <div className="flex flex-col">
        {suggestions.map((suggestion) => (
          <SuggestionsPartButton key={suggestion} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
});
SuggestionsPart.displayName = "SuggestionsPart";

const SuggestionsPartButton = memo(
  ({ suggestion }: { suggestion: DataPart["suggestions"]["data"][number] }) => {
    const { sendMessage, status } = useChat((state) => state.chat);

    const disabled = status === "submitted" || status === "streaming";

    return (
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-6 border-t py-2 text-start transition-colors ease-out hover:text-primary"
        disabled={disabled}
        onClick={() => sendMessage({ text: suggestion })}
        type="button"
      >
        {suggestion}
        <PlusIcon className="size-4 shrink-0 text-primary" />
      </button>
    );
  }
);
SuggestionsPartButton.displayName = "SuggestionsPartButton";
