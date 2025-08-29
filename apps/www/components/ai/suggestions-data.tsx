"use client";

import { PlusIcon, QuoteIcon } from "lucide-react";
import { useChat } from "@/lib/context/use-chat";

type Props = {
  suggestions: string[];
};

export function SuggestionsData({ suggestions }: Props) {
  const { sendMessage } = useChat((state) => state.chat);

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
}
