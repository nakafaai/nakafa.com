"use client";

import type { DataPart } from "@repo/ai/types/data-parts";
import { PlusIcon, QuoteIcon } from "lucide-react";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

type Props = {
  message: DataPart["suggestions"];
};

export const SuggestionsPart = memo(({ message }: Props) => {
  const { sendMessage } = useChat((state) => state.chat);

  const suggestions = message.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <QuoteIcon className="size-4" />
        <span>Related</span>
      </div>
      <div className="flex flex-col">
        {suggestions.map((suggestion) => (
          <button
            className="flex w-full cursor-pointer items-center justify-between gap-6 border-t py-2 text-start transition-colors ease-out hover:text-primary"
            key={suggestion}
            onClick={() => sendMessage({ text: suggestion })}
            type="button"
          >
            {suggestion}
            <PlusIcon className="size-4 shrink-0 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
});
SuggestionsPart.displayName = "SuggestionsPart";
