"use client";

import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";

import { AiChatHeader } from "@/components/ai/chat-header";
import { useChat } from "@/components/ai/context/use-chat";
import { NinaInput } from "@/components/ai/input";
import { NinaTranscript } from "@/components/ai/transcript";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

export function AiChat() {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <AiChatHeader />

      <NinaTranscript />

      <AiChatToolbar />
    </div>
  );
}

function AiChatToolbar() {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  const canWrite = useChat((state) => state.canWrite);

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);

  const { send, busy, isPending, cancel, isLoading } = useChat(
    (state) => state
  );

  function handleSubmit(message: PromptInputMessage) {
    if (busy) {
      cancel();
      return false;
    }

    if (!message.text?.trim()) {
      return false;
    }

    if (isUserPending) {
      return false;
    }

    if (viewer === null) {
      router.push(authNavigation.readHref());
      return false;
    }

    return send({
      text: message.text,
      ...(message.files === undefined ? {} : { files: message.files }),
    });
  }

  // only show when user is the owner of the chat
  if (!canWrite) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl shrink-0 px-4 pb-4">
      <NinaInput
        disabled={isPending || isLoading || isUserPending}
        onSubmit={handleSubmit}
        status={busy ? "streaming" : "ready"}
      />
    </div>
  );
}
AiChatToolbar.displayName = "AIChatToolbar";
