"use client";

import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Message } from "@repo/design-system/components/ui/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import type { ComponentProps } from "react";
import type { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

type ComposerPrompt = ReturnType<typeof useChatAdmission>["prompt"];
type ComposerSubmit = ComponentProps<typeof NinaInput>["onSubmit"];

/** The prompt that is on its way, then the input that sends the next one. */
export function Composer({
  attachments,
  autoFocus,
  disabled,
  onAttachRequest,
  onEngage,
  onSubmit,
  prompt,
}: {
  attachments: boolean;
  autoFocus?: boolean | undefined;
  disabled: boolean;
  onAttachRequest?: (() => void) | undefined;
  onEngage?: (() => void) | undefined;
  onSubmit: ComposerSubmit;
  prompt: ComposerPrompt;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {prompt ? (
        <>
          <Message align="end">
            <NinaPrompt files={prompt.files}>
              <DeferredLearnerText>{prompt.text}</DeferredLearnerText>
            </NinaPrompt>
          </Message>
          {/* The prompt is on its way: show the turn as started, as the page's new chat does. */}
          <Message>
            <TypingLoader />
          </Message>
        </>
      ) : null}
      <NinaInput
        attachments={attachments}
        autoFocus={autoFocus}
        disabled={disabled}
        onAttachRequest={onAttachRequest}
        onEngage={onEngage}
        onSubmit={onSubmit}
      />
    </div>
  );
}
