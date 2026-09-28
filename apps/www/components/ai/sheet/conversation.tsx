"use client";

import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";

import { useChat } from "@/components/ai/chat/context";
import { NinaInput } from "@/components/ai/input";
import { NinaTranscript } from "@/components/ai/transcript";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Renders messages and the active chat input inside Nina sheet. */
export function SheetMain() {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  const { send, busy, isPending, cancel, isLoading } = useChat(
    (state) => state
  );

  /** Sends a message or stops the current stream from the sheet input. */
  function handleSubmit(message: PromptInputMessage) {
    if (isLoading || isPending) {
      return false;
    }
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
      ...(message.files === undefined ? {} : { files: message.files }),
      text: message.text,
    });
  }

  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <NinaTranscript />

      <div className="grid shrink-0 px-2 pb-2">
        <NinaInput
          autoFocus
          disabled={isPending || isLoading || isUserPending}
          onSubmit={handleSubmit}
          status={busy ? "streaming" : "ready"}
        />
      </div>
    </div>
  );
}
