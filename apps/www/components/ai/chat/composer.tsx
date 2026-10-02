"use client";

import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import type { ComponentProps } from "react";
import { useChat } from "@/components/ai/chat/context";
import { NinaInput } from "@/components/ai/input";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Continues one conversation with the same stop, sign-in and send policy on every surface. */
export function ChatComposer(
  props: Pick<ComponentProps<typeof NinaInput>, "autoFocus">
) {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  const send = useChat((state) => state.send);
  const busy = useChat((state) => state.busy);
  const isPending = useChat((state) => state.isPending);
  const cancel = useChat((state) => state.cancel);
  const isLoading = useChat((state) => state.isLoading);

  function handleSubmit(message: PromptInputMessage) {
    if (isLoading || isPending) {
      return false;
    }
    if (busy) {
      cancel();
      return false;
    }
    if (!message.text?.trim() || isUserPending) {
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

  return (
    <NinaInput
      {...props}
      disabled={isPending || isLoading || isUserPending}
      onSubmit={handleSubmit}
      status={busy ? "streaming" : "ready"}
    />
  );
}
