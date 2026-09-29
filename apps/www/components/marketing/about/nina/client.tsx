"use client";

import { Message } from "@repo/design-system/components/ui/message";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const router = useRouter();
  const { disabled, prompt, promptId, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {prompt ? (
        <Message align="end">
          <NinaPrompt
            files={prompt.files ?? []}
            id={promptId}
            text={prompt.text}
          />
        </Message>
      ) : null}
      <NinaInput disabled={disabled} onSubmit={submit} />
    </div>
  );
}
