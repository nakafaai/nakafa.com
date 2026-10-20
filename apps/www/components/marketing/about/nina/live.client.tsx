"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { Composer } from "@/components/marketing/about/nina/composer";

/**
 * A signed-in account's composer: its prompt starts a chat through admission.
 * It lives in its own module, so a visitor's page loads no admission or
 * submission code.
 */
export function LiveNinaComposer() {
  const router = useRouter();
  const { disabled, prompt, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return (
    <Composer
      attachments
      disabled={disabled}
      onSubmit={submit}
      prompt={prompt}
    />
  );
}
