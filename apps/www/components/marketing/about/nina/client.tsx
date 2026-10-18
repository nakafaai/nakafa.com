"use client";

import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Message } from "@repo/design-system/components/ui/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const router = useRouter();
  const { disabled, prompt, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

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
      <NinaInput disabled={disabled} onSubmit={submit} />
    </div>
  );
}
