import { Add01Icon, QuoteDownIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { TypedText } from "@repo/design-system/components/ui/typed";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { useChat } from "@/components/ai/chat/context";

/** The time each letter of a follow-up takes to write, in milliseconds. */
const LETTER_MS = 14;

interface Props {
  /** Whether the follow-ups arrived while the reader watched, so they write out. */
  live: boolean;
  suggestions: readonly string[];
}

/**
 * The follow-up questions after an answer. The server saves each question once
 * Nina has finished it, so they arrive one by one. Questions that arrive while
 * the reader watches write out letter by letter, each laid out whole from the
 * first frame so no row moves while it is written; questions that were there
 * when the chat opened show at once.
 */
export function SuggestionsPart({ live, suggestions }: Props) {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <HugeIcons icon={QuoteDownIcon} />
        <span>{t("follow-up")}</span>
      </div>
      <div className="flex flex-col">
        {Arr.map(suggestions, (suggestion) => (
          <SuggestionsPartButton key={suggestion} suggestion={suggestion}>
            {live ? (
              <TypedText
                caret={false}
                playing
                step={LETTER_MS}
                text={suggestion}
              />
            ) : (
              suggestion
            )}
          </SuggestionsPartButton>
        ))}
      </div>
    </div>
  );
}
SuggestionsPart.displayName = "SuggestionsPart";

function SuggestionsPartButton({
  children,
  suggestion,
}: {
  children: ReactNode;
  suggestion: string;
}) {
  const send = useChat((state) => state.send);
  const busy = useChat((state) => state.busy);

  return (
    <button
      className="hover:text-primary flex w-full items-center justify-between gap-6 border-t py-2 text-start transition-colors ease-out"
      disabled={busy}
      onClick={() => send({ text: suggestion })}
      type="button"
    >
      {children}
      <HugeIcons className="text-primary" icon={Add01Icon} />
    </button>
  );
}
SuggestionsPartButton.displayName = "SuggestionsPartButton";
