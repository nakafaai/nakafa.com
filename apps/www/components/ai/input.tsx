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
} from "@repo/backend/client/nina/uploads";
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
import type { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { randomUuid } from "@repo/utilities/uuid";
import type { ChatStatus } from "ai";
import { cn } from "cn";
import { Array as Arr, Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  NinaAttach,
  NinaAttachments,
  RejectedFiles,
} from "@/components/ai/attachment";
import { REJECTION_NOTICE, rejectionNotice } from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";
import {
  NINA_NOTICE_POSITION,
  ninaFailureLimits,
  promptRefusal,
  reportNinaFailure,
} from "@/components/ai/feedback";

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
  const composerKey = useAi((state) => state.composerKey);
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);
  const [submittedFiles, hideSubmittedFiles] = useOptimistic<readonly string[]>(
    []
  );
  const [, startTransition] = useTransition();

  // While Nina answers, the button stops the reply and a press sends no text.
  const answering = status === "streaming";

  function handleSubmit(message: PromptInputMessage) {
    const refusal = promptRefusal(message.text, answering);
    if (Option.isSome(refusal)) {
      Effect.runFork(
        reportNinaFailure(
          refusal.value,
          t("failures.prompt-length", ninaFailureLimits)
        )
      );
      return false;
    }
    const admission = onSubmit(message);
    if (admission === false) {
      return false;
    }
    startTransition(async () => {
      hideSubmittedFiles(Arr.map(message.files ?? [], (file) => file.id));
      // Once the message is sent, the notice about the files an earlier pick
      // did not attach has done its work.
      if (await admission) {
        toast.dismiss(REJECTION_NOTICE);
      }
    });
    return admission;
  }

  /**
   * Says why a pick was not attached in full: one notice for the pick, naming
   * the files it dropped and the reason of each. Two notices would stack, and
   * the one in front would hide the other, so the notice has one id, and a new
   * pick replaces it. A learner needs time to read a list of names, and a list
   * that scrolls cannot be used in a notice that is about to leave, so it stays
   * until the learner closes it, picks again, or sends the message. A pick that
   * attached every file takes the notice away, since its names are no longer a
   * problem.
   */
  function handlePick(rejections: readonly PromptInputFileConstraintError[]) {
    if (!Arr.isReadonlyArrayNonEmpty(rejections)) {
      toast.dismiss(REJECTION_NOTICE);
      return;
    }
    const notice = rejectionNotice(rejections, t);
    toast.error(notice.title, {
      // A new pick is a new list. With a key of its own it starts at its top,
      // not where the list it replaces was scrolled to.
      description: (
        <RejectedFiles
          key={Effect.runSync(randomUuid)}
          reasons={notice.reasons}
        />
      ),
      duration: Number.POSITIVE_INFINITY,
      id: REJECTION_NOTICE,
      position: NINA_NOTICE_POSITION,
    });
  }

  // The files of a composer live in the state of its PromptInput, and a new key
  // is how React starts that state over. The key changes with the text of the
  // draft, when the draft stops belonging to the learner who is signed in, so
  // every surface of this composer drops the files the previous learner picked.
  return (
    <PromptInput
      accept={Arr.join(NinaFileType.literals, ",")}
      key={composerKey}
      maxFileSize={NINA_FILE_SIZE}
      maxFiles={NINA_FILE_COUNT}
      multiple
      onPick={handlePick}
      onSubmit={handleSubmit}
    >
      {children}
      <InputGroup
        className={cn(
          "rounded-3xl bg-muted/50 text-chat shadow-none",
          className
        )}
      >
        <NinaAttachments submittedFiles={submittedFiles} />
        <PromptInputTextarea
          aria-label={t("text-placeholder")}
          autoFocus={autoFocus}
          className="text-(length:--text-chat) md:text-(length:--text-chat) max-h-[min(12rem,35dvh)] px-3 py-3"
          onChange={(event) => setText(event.target.value)}
          onFocus={() =>
            // Load the stylesheet's math faces before streamed formulas arrive.
            Effect.runPromise(
              Effect.tryPromise(() =>
                Promise.all([
                  document.fonts.load("16px KaTeX_Main"),
                  document.fonts.load("italic 16px KaTeX_Math"),
                ])
              ).pipe(Effect.ignore)
            )
          }
          placeholder={t("text-placeholder")}
          value={text}
        />
        <InputGroupAddon
          align="block-end"
          className="justify-between gap-2 group-has-[>[data-slot=input-group-control]]/input-group:pb-3"
        >
          <NinaAttach />
          <div className="flex items-center gap-1">
            <InputGroupButton
              aria-label={
                answering && !disabled ? t("stop-response") : t("send-message")
              }
              className="rounded-full"
              disabled={disabled}
              size="icon"
              type="submit"
              variant="default"
            >
              <HugeIcons
                icon={answering && !disabled ? StopIcon : ArrowUp02Icon}
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
  const hasFiles = usePromptInputAttachments(
    (attachments) => attachments.files.length > 0
  );
  if (text.trim() || hasFiles) {
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
      {Arr.map(suggestions, (suggestion) => (
        <Button
          aria-label={suggestion.prompt}
          className="group h-auto min-h-9 w-full justify-start whitespace-normal py-1.5 font-normal shadow-none"
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
