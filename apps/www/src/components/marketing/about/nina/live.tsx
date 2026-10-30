import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import { useNavigate } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import { useEffect, useRef } from "react";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPromptTurn } from "@/components/marketing/about/nina/composer";
import {
  useHeldAttach,
  useHeldPrompt,
} from "@/components/marketing/about/nina/held";
import { useLiveSession } from "@/components/providers/live";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * A signed-in account's composer: its prompt starts a chat through admission. Its
 * own island mounts the page's one Convex client around the admission code. A send
 * the learner pressed before this code loaded is admitted once it mounts, and an
 * attach pressed then opens the file picker.
 */
export function LiveNinaComposer() {
  const client = useLiveSession((state) => state.client);
  if (Option.isNone(client)) {
    return null;
  }
  return (
    <ConvexProvider client={client.value}>
      <LiveNinaAdmission />
    </ConvexProvider>
  );
}

/** Sends the composer's prompt through admission, then opens the new chat. */
function LiveNinaAdmission() {
  const held = useHeldPrompt();
  const attach = useHeldAttach();
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  const { disabled, prompt, submit } = useChatAdmission({
    onComplete: (chatId) =>
      navigate({ params: { id: chatId, locale }, to: "/$locale/chat/$id" }),
  });
  const admittedHeld = useRef(false);

  useEffect(() => {
    if (held === null || admittedHeld.current) {
      return;
    }
    admittedHeld.current = true;
    submit(held);
  }, [held, submit]);

  return (
    <NinaInput attachments autoFocus disabled={disabled} onSubmit={submit}>
      {attach ? <HeldAttachPicker /> : null}
      {prompt ? <NinaPromptTurn prompt={prompt} /> : null}
    </NinaInput>
  );
}

/**
 * Opens the composer's file picker once, for the attach the learner pressed
 * before this composer loaded. A browser opens a picker only within a short time
 * after a press, so this composer opens it as soon as it mounts.
 */
function HeldAttachPicker() {
  const openFileDialog = usePromptInputAttachments(
    (attachments) => attachments.openFileDialog
  );
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    openFileDialog();
  }, [openFileDialog]);

  return null;
}
