"use client";

import { DeferredLearnerText } from "@repo/design-system/components/markdown/deferred";
import { Message } from "@repo/design-system/components/ui/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import type { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaPrompt } from "@/components/ai/message/prompt";

/** The prompt that is on its way, then the typing loader that shows the turn as started. */
export function NinaPromptTurn({
  prompt,
}: {
  prompt: NonNullable<ReturnType<typeof useChatAdmission>["prompt"]>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-6">
      <Message align="end">
        <NinaPrompt files={prompt.files}>
          <DeferredLearnerText>{prompt.text}</DeferredLearnerText>
        </NinaPrompt>
      </Message>
      {/* The prompt is on its way: show the turn as started, as the page's new chat does. */}
      <Message>
        <TypingLoader />
      </Message>
    </div>
  );
}
