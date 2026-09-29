"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import {
  type ComponentProps,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { useAi } from "@/components/ai/context";
import type { NinaPrompt } from "@/components/ai/message/prompt";
import { useNinaSubmission } from "@/components/ai/submission";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Keeps new-chat admission, optimistic prompts and rollback identical at every entry. */
export function useChatAdmission({
  onComplete,
  onSignIn,
}: {
  onComplete: (chatId: Id<"chats">) => void;
  onSignIn?: () => void;
}) {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const setText = useAi((state) => state.setText);
  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  const { send } = useNinaSubmission();
  const [isPending, startTransition] = useTransition();
  const [prompt, showPrompt] = useOptimistic<
    | (Required<Pick<ComponentProps<typeof NinaPrompt>, "files">> & {
        text: string;
      })
    | null
  >(null);
  const promptId = useId();
  const activation = useRef(0);
  const viewerId = viewer?.id;

  useEffect(() => {
    if (!viewerId) {
      return;
    }
    return () => {
      activation.current += 1;
    };
  }, [viewerId]);

  function submit(message: PromptInputMessage) {
    const query = message.text?.trim();
    if (!query || isUserPending || isPending) {
      return false;
    }
    if (viewer === null) {
      onSignIn?.();
      router.push(authNavigation.readHref());
      return false;
    }
    const draft = { ...message, text: query };
    const submittedFrom = activation.current;
    const admission = send(draft);
    startTransition(async () => {
      showPrompt({ text: draft.text, files: draft.files ?? [] });
      setText("");
      const receipt = await admission;
      if (activation.current !== submittedFrom) {
        return;
      }
      if (!receipt) {
        setText((previous) => previous || query);
        return;
      }
      startTransition(() => {
        showPrompt({
          text: receipt.prompt.text,
          files: receipt.prompt.files.map(({ filename, ...file }) => ({
            ...file,
            type: "file",
            ...(filename === undefined ? {} : { filename }),
          })),
        });
        onComplete(receipt.chatId);
      });
    });
    return admission.then((receipt) => receipt !== undefined);
  }

  return { disabled: isPending || isUserPending, prompt, promptId, submit };
}
