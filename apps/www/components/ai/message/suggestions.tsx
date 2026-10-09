"use client";

import { Add01Icon, QuoteDownIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";

import { useChat } from "@/components/ai/chat/context";

interface Props {
  suggestions: readonly string[];
}

export function SuggestionsPart({ suggestions }: Props) {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4" icon={QuoteDownIcon} />
        <span>{t("follow-up")}</span>
      </div>
      <div className="flex flex-col">
        {Arr.map(suggestions, (suggestion) => (
          <SuggestionsPartButton key={suggestion} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
}
SuggestionsPart.displayName = "SuggestionsPart";

function SuggestionsPartButton({ suggestion }: { suggestion: string }) {
  const send = useChat((state) => state.send);
  const busy = useChat((state) => state.busy);

  return (
    <button
      className="flex w-full cursor-pointer items-center justify-between gap-6 border-t py-2 text-start transition-colors ease-out hover:text-primary"
      disabled={busy}
      onClick={() => send({ text: suggestion })}
      type="button"
    >
      {suggestion}
      <HugeIcons className="size-4 text-primary" icon={Add01Icon} />
    </button>
  );
}
SuggestionsPartButton.displayName = "SuggestionsPartButton";
