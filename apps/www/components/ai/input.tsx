"use client";

import {
  ArrowRight02Icon,
  ArrowUp02Icon,
  BookOpenTextIcon,
  LeftToRightListBulletIcon,
  Quiz03Icon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import {
  NINA_FILE_COUNT,
  NINA_FILE_SIZE,
  NinaFileType,
} from "@repo/backend/confect/nina/uploads.spec";
import {
  PromptInput,
  PromptInputTextarea,
} from "@repo/design-system/components/ai/input";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@repo/design-system/components/ui/input-group";
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import type { ChatStatus } from "ai";
import { cn } from "cn";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { NinaAttach, NinaAttachments } from "@/components/ai/attachment";

import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";

interface Props {
  autoFocus?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onSubmit: (message: PromptInputMessage) => boolean | Promise<boolean>;
  status?: ChatStatus;
}

/** One attachment-capable composer for Nina's home, conversation and sheet. */
export function NinaInput({
  autoFocus,
  children,
  className,
  disabled,
  onSubmit,
  status,
}: Props) {
  const t = useTranslations("Ai");
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);
  const [submittedFiles, hideSubmittedFiles] = useOptimistic<readonly string[]>(
    []
  );
  const [, startTransition] = useTransition();

  function handleSubmit(message: PromptInputMessage) {
    const admission = onSubmit(message);
    if (admission === false) {
      return false;
    }
    startTransition(async () => {
      hideSubmittedFiles(message.files?.map((file) => file.id) ?? []);
      await admission;
    });
    return admission;
  }

  return (
    <PromptInput
      accept={NinaFileType.literals.join(",")}
      maxFileSize={NINA_FILE_SIZE}
      maxFiles={NINA_FILE_COUNT}
      multiple
      onError={() => toast.error(t("attachment-rejected"))}
      onSubmit={handleSubmit}
    >
      {children}
      <InputGroup
        className={cn(
          "rounded-3xl bg-muted/50 p-2 text-chat shadow-none",
          className
        )}
      >
        <NinaAttachments submittedFiles={submittedFiles} />
        <PromptInputTextarea
          aria-label={t("text-placeholder")}
          autoFocus={autoFocus}
          className="text-(length:--text-chat) md:text-(length:--text-chat) px-2 py-2"
          onChange={(event) => setText(event.target.value)}
          onFocus={() => {
            // Load the stylesheet's math faces before streamed formulas arrive.
            return Effect.runPromise(
              Effect.tryPromise(() =>
                Promise.all([
                  document.fonts.load("16px KaTeX_Main"),
                  document.fonts.load("italic 16px KaTeX_Math"),
                ])
              ).pipe(Effect.ignore)
            );
          }}
          placeholder={t("text-placeholder")}
          value={text}
        />
        <InputGroupAddon
          align="block-end"
          className="justify-between gap-2 px-1 pb-1"
        >
          <NinaAttach />
          <div className="flex items-center gap-1">
            <AiChatModel />
            <InputGroupButton
              aria-label={
                status === "streaming" && !disabled
                  ? t("stop-response")
                  : t("send-message")
              }
              className="rounded-full"
              disabled={disabled}
              size="icon"
              type="submit"
              variant="default"
            >
              <HugeIcons
                icon={
                  status === "streaming" && !disabled ? StopIcon : ArrowUp02Icon
                }
              />
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </PromptInput>
  );
}

/** Offers page-specific first prompts only in the empty conversation. */
export function NinaSuggestions({
  disabled,
  onSubmit,
}: Pick<Props, "disabled" | "onSubmit">) {
  const t = useTranslations("Ai");
  const contextTitle = useAi((state) => state.contextTitle);
  const text = useAi((state) => state.text);
  const attachments = usePromptInputAttachments();
  if (text.trim() || attachments.files.length > 0) {
    return null;
  }
  const title = contextTitle?.trim() || t("suggestion-current-material");
  const suggestions = [
    {
      icon: BookOpenTextIcon,
      label: t("suggestion-explain"),
      prompt: t("suggestion-explain-prompt", { title }),
    },
    {
      icon: Quiz03Icon,
      label: t("suggestion-example"),
      prompt: t("suggestion-example-prompt", { title }),
    },
    {
      icon: LeftToRightListBulletIcon,
      label: t("suggestion-summary"),
      prompt: t("suggestion-summary-prompt", { title }),
    },
  ];
  return (
    <div className="flex flex-col gap-2 pb-4">
      {suggestions.map((suggestion) => (
        <Button
          aria-label={suggestion.prompt}
          className="group w-full justify-start font-normal shadow-none"
          disabled={disabled}
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
  );
}
