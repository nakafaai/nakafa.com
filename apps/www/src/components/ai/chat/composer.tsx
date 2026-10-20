"use client";

import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { useChat } from "@/components/ai/chat/context";
import { readComposerSubmit } from "@/components/ai/chat/submit";
import { NinaInput } from "@/components/ai/input";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { useViewer } from "@/lib/identity/client";

/**
 * Continues one conversation with the same owner, stop, sign-in and send
 * policy on every surface. Only the owner can continue a conversation, so
 * anyone else gets no composer. `className` places the composer on the surface.
 */
export function ChatComposer({
  className,
  ...props
}: Pick<ComponentProps<typeof NinaInput>, "autoFocus"> & {
  className?: string;
}) {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  const canWrite = useChat((state) => state.canWrite);
  const send = useChat((state) => state.send);
  const busy = useChat((state) => state.busy);
  const isPending = useChat((state) => state.isPending);
  const cancel = useChat((state) => state.cancel);
  const isLoading = useChat((state) => state.isLoading);

  function handleSubmit(message: PromptInputMessage) {
    // Every composer sends the text trimmed, as a new chat does.
    const text = message.text?.trim() ?? "";
    const action = readComposerSubmit({
      busy,
      hasText: text !== "",
      loading: isLoading,
      pending: isPending,
      signedIn: viewer !== null,
      userPending: isUserPending,
    });
    if (action === "sign-in") {
      router.push(authNavigation.readHref());
      return false;
    }
    if (action === "keep") {
      return false;
    }

    return send({
      text,
      ...(message.files === undefined ? {} : { files: message.files }),
    });
  }

  if (!canWrite) {
    return null;
  }

  return (
    <div className={cn("grid shrink-0", className)}>
      <NinaInput
        {...props}
        disabled={isPending || isLoading || isUserPending}
        onStop={cancel}
        onSubmit={handleSubmit}
        status={busy ? "streaming" : "ready"}
      />
    </div>
  );
}
