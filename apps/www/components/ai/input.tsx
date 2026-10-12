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
  NINA_PROMPT_LENGTH,
  NINA_PROMPT_LENGTH_MESSAGE,
  NinaPromptError,
} from "@repo/backend/client/nina/prompt";
import {
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
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
import type { ChatStatus } from "ai";
import { cn } from "cn";
import { Array as Arr, Effect, Match } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { NinaAttach, NinaAttachments } from "@/components/ai/attachment";
import { useAi } from "@/components/ai/context";
import {
  NINA_NOTICE_POSITION,
  ninaFailureLimits,
  reportNinaFailure,
} from "@/components/ai/feedback";

/** How many file names a notice lists for one reason before it counts the rest. */
const NAMES_SHOWN = 3;

/**
 * The reasons one pick was not attached in full. Each reason has its sentence
 * and the names of the files it dropped, one to a line, and how many more.
 */
function RejectedFiles({
  reasons,
}: {
  reasons: readonly {
    more: string | null;
    names: readonly string[];
    sentence: string;
  }[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {Arr.map(reasons, (reason) => (
        <li key={reason.sentence}>
          <p>{reason.sentence}</p>
          <ul className="flex flex-col gap-0.5 font-medium">
            {Arr.map(Arr.dedupe(reason.names), (name) => (
              <li className="wrap-anywhere" key={name}>
                {name}
              </li>
            ))}
            {reason.more ? <li>{reason.more}</li> : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}

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
    // A prompt over the limit stays in the composer with the limit named, and
    // nothing is asked of the server. The page composers send the text trimmed,
    // so the trimmed length is the one that counts; a conversation sends it
    // as written, and the server's own refusal names the same limit.
    if ((message.text?.trim().length ?? 0) > NINA_PROMPT_LENGTH) {
      Effect.runFork(
        reportNinaFailure(
          new NinaPromptError({
            code: "NINA_PROMPT_LENGTH",
            message: NINA_PROMPT_LENGTH_MESSAGE,
          }),
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
      await admission;
    });
    return admission;
  }

  /**
   * Says why a pick was not attached in full: one notice for the pick, with
   * each reason followed by the files it dropped. Two notices would stack, and
   * the one in front would hide the other.
   */
  function handleFileErrors(
    rejections: readonly PromptInputFileConstraintError[]
  ) {
    const dropped = Arr.reduce(
      rejections,
      0,
      (total, rejection) => total + rejection.files.length
    );
    toast.error(t("attachment-rejections.title", { count: dropped }), {
      description: (
        <RejectedFiles
          reasons={Arr.map(rejections, (rejection) => {
            const count = rejection.files.length;
            const names = Arr.take(rejection.files, NAMES_SHOWN);
            const more = count - names.length;
            return {
              more:
                more > 0
                  ? t("attachment-rejections.more", { count: more })
                  : null,
              names,
              sentence: Match.value(rejection.code).pipe(
                Match.when("accept", () => t("attachment-rejections.type")),
                Match.when("empty", () =>
                  t("attachment-rejections.empty", { count })
                ),
                Match.when("max_file_size", () =>
                  t("attachment-rejections.size", {
                    count,
                    size: NINA_FILE_MEBIBYTES,
                  })
                ),
                Match.when("max_files", () =>
                  t("attachment-rejections.count", { count: NINA_FILE_COUNT })
                ),
                Match.exhaustive
              ),
            };
          })}
        />
      ),
      id: "nina-files",
      position: NINA_NOTICE_POSITION,
    });
  }

  return (
    <PromptInput
      accept={Arr.join(NinaFileType.literals, ",")}
      maxFileSize={NINA_FILE_SIZE}
      maxFiles={NINA_FILE_COUNT}
      multiple
      onError={handleFileErrors}
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
