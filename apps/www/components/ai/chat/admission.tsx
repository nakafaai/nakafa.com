"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAi } from "@/components/ai/context";
import type { NinaPrompt } from "@/components/ai/message/prompt";
import { restoreRefusedText } from "@/components/ai/store/draft";
import { useNinaSubmission } from "@/components/ai/submission";
import { useAuthSessionStore } from "@/components/auth/session";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Admission waits for identity and sends signed-out learners to sign in. */
export function useAdmissionGate(onSignIn?: () => void) {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const pending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);

  /** Returns whether a prompt may be admitted for the current viewer now. */
  function admit() {
    if (pending) {
      return false;
    }
    if (viewer === null) {
      onSignIn?.();
      router.push(authNavigation.readHref());
      return false;
    }
    return true;
  }

  return { admit, pending, viewerId: viewer?.id };
}

/** Keeps new-chat admission, optimistic prompts and rollback identical at every entry. */
export function useChatAdmission({
  onComplete,
  onSignIn,
  shown = true,
}: {
  onComplete: (chatId: Id<"chats">) => void;
  onSignIn?: () => void;
  /**
   * Whether the surface that started the prompt still shows it. A surface the
   * learner closed while the prompt is admitted counts as left: its learner is
   * told once, and no chat opens over the surface they closed.
   */
  shown?: boolean;
}) {
  const gate = useAdmissionGate(onSignIn);
  const session = useAuthSessionStore();
  const setText = useAi((state) => state.setText);
  // A new chat is on its way, from any surface, until its admission settles.
  const admitting = useAi((state) => state.chatDrafts.length > 0);
  const t = useTranslations("Ai");
  const { send } = useNinaSubmission();
  // The prompt Nina is admitting, shown before its chat exists.
  const [prompt, setPrompt] = useState<
    | (Required<Pick<ComponentProps<typeof NinaPrompt>, "files">> & {
        text: string;
      })
    | null
  >(null);
  const promptId = useId();
  const activation = useRef(0);
  // The receipt reads the surface as it is when the answer lands, not as it was
  // when the prompt was sent.
  const shownNow = useRef(shown);
  useLayoutEffect(() => {
    shownNow.current = shown;
  });
  const viewerId = gate.viewerId;
  // The prompt stays until the admission is refused, or until the surface that
  // shows it hides or ends, so the composer waits for the chat it opens.
  const busy = admitting || prompt !== null;

  // Leaving, hiding or changing viewer ends this activation, so a prompt that
  // is still being admitted opens no chat over the one the learner picked
  // meanwhile. A hidden Activity runs this cleanup, as the sheet's new-chat
  // body is hidden once a chat is open.
  useEffect(() => {
    if (!viewerId) {
      return;
    }
    return () => {
      activation.current += 1;
      setPrompt(null);
    };
  }, [viewerId]);

  function submit(message: PromptInputMessage) {
    const query = message.text?.trim();
    if (!query || busy || !gate.admit()) {
      return false;
    }
    const draft = { ...message, text: query };
    const submittedFrom = activation.current;
    const submittedBy = session.getState().userId;
    // No async transition holds the admission. React makes every transition that
    // starts while one is pending wait for its end, the navigation to another
    // chat included, so the learner could not leave until the answer came back.
    // The text goes first: if the store refuses the write, no prompt is left on its way.
    setText("");
    setPrompt({ text: draft.text, files: draft.files ?? [] });
    return send(draft)
      .then((receipt) => {
        if (!receipt) {
          // The words go back to the composer wherever the learner has gone
          // meanwhile, ahead of anything typed since, so a refusal never loses
          // them. Another account that has signed in since does not get them.
          setPrompt(null);
          setText((typed) =>
            restoreRefusedText({
              refused: query,
              sentBy: submittedBy,
              signedInAs: session.getState().userId,
              typed,
            })
          );
          return false;
        }
        if (activation.current !== submittedFrom || !shownNow.current) {
          // The learner left, or closed the surface, before the answer came back.
          // The chat exists now, so they are told once and may open it, but they
          // are not moved. The admission has settled, so its prompt is no longer
          // on its way, even if the surface is shown again before it hides.
          setPrompt(null);
          toast(t("admitted-elsewhere"), {
            action: {
              label: t("open-chat"),
              onClick: () => onComplete(receipt.chatId),
            },
          });
          return true;
        }
        setPrompt({
          text: receipt.prompt.text,
          files: Arr.map(receipt.prompt.files, ({ filename, ...file }) => ({
            ...file,
            type: "file",
            ...(filename === undefined ? {} : { filename }),
          })),
        });
        onComplete(receipt.chatId);
        return true;
      })
      .catch((defect: unknown) => {
        // A defect ends the admission without an answer, so its prompt leaves at
        // once and the composer is not held. The defect still reaches the caller.
        // The words stay out of the composer: the server may already have admitted
        // them, and a second send would repeat the prompt.
        setPrompt(null);
        return Promise.reject(defect);
      });
  }

  return { disabled: busy || gate.pending, prompt, promptId, submit };
}
