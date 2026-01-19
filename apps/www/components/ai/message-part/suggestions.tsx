"use client";

import { Add01Icon, QuoteDownIcon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data-parts";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

interface Props {
  message: DataPart["suggestions"];
}

export const SuggestionsPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const suggestions = message.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4" icon={QuoteDownIcon} />
        <span>{t("related")}</span>
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
        <HugeIcons className="size-4 text-primary" icon={Add01Icon} />
      </button>
    );
  }
);
SuggestionsPartButton.displayName = "SuggestionsPartButton";
