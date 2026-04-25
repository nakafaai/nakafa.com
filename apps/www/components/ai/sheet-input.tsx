"use client";

import {
  ArrowRight02Icon,
  BookOpenTextIcon,
  LeftToRightListBulletIcon,
  Quiz03Icon,
} from "@hugeicons/core-free-icons";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ChatStatus } from "ai";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";

interface Props {
  disabled?: boolean;
  isPending?: boolean;
  onSubmit: (message: PromptInputMessage) => void;
  status?: ChatStatus;
}

/** Renders Nina prompt input and the empty-chat suggestion stack. */
export const SheetInput = memo(
  ({ disabled, isPending, onSubmit, status }: Props) => {
    const t = useTranslations("Ai");

    const activeChatId = useAi((state) => state.activeChatId);
    const contextTitle = useAi((state) => state.contextTitle);
    const text = useAi((state) => state.text);
    const setText = useAi((state) => state.setText);
    const effectiveSuggestionTitle =
      contextTitle?.trim() || t("suggestion-current-material");
    const promptSuggestions = [
      {
        icon: BookOpenTextIcon,
        label: t("suggestion-explain"),
        prompt: t("suggestion-explain-prompt", {
          title: effectiveSuggestionTitle,
        }),
      },
      {
        icon: Quiz03Icon,
        label: t("suggestion-example"),
        prompt: t("suggestion-example-prompt", {
          title: effectiveSuggestionTitle,
        }),
      },
      {
        icon: LeftToRightListBulletIcon,
        label: t("suggestion-summary"),
        prompt: t("suggestion-summary-prompt", {
          title: effectiveSuggestionTitle,
        }),
      },
    ];
    const showSuggestions = !activeChatId && text.trim().length === 0;

    return (
      <div className="grid shrink-0 px-2 pb-2">
        {showSuggestions ? (
          <div className="flex flex-col gap-2 pb-4">
            {promptSuggestions.map((suggestion) => (
              <Button
                aria-label={suggestion.prompt}
                className="group w-full justify-start font-normal shadow-none"
                disabled={disabled || isPending}
                key={suggestion.label}
                onClick={() => onSubmit({ text: suggestion.prompt })}
                type="button"
                variant="outline"
              >
                <HugeIcons data-icon="inline-start" icon={suggestion.icon} />
                <span className="flex-1 text-left">{suggestion.label}</span>
                <HugeIcons
                  aria-hidden="true"
                  className="opacity-0 transition-opacity ease-out group-hover:opacity-100"
                  data-icon="inline-end"
                  icon={ArrowRight02Icon}
                />
              </Button>
            ))}
          </div>
        ) : null}
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea
            aria-label={t("text-placeholder")}
            autoFocus
            onChange={(event) => setText(event.target.value)}
            placeholder={t("text-placeholder")}
            value={text}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <AiChatModel />
            </PromptInputTools>
            <PromptInputSubmit
              disabled={disabled}
              isPending={isPending}
              status={status}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    );
  }
);
