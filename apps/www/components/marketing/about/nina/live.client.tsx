"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { Composer } from "@/components/marketing/about/nina/composer";

/**
 * A signed-in account's composer: its prompt starts a chat through admission. Its
 * own island mounts the page's one Convex client around the admission code.
 */
export function LiveNinaComposer({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexProvider client={client}>
      <LiveNinaAdmission />
    </ConvexProvider>
  );
}

/** Sends the composer's prompt through admission, then opens the new chat. */
function LiveNinaAdmission() {
  const router = useRouter();
  const { disabled, prompt, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return (
    <Composer
      attachments
      autoFocus
      disabled={disabled}
      onSubmit={submit}
      prompt={prompt}
    />
  );
}
