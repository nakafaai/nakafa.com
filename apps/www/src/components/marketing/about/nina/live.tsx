import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useCurrentLocale } from "@repo/internationalization/src/link";
import { useNavigate } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import { useEffect, useRef } from "react";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPromptTurn } from "@/components/marketing/about/nina/composer";
import { useLiveSession } from "@/components/providers/live";

/**
 * A signed-in account's composer: its prompt starts a chat through admission. Its
 * own island mounts the page's one Convex client around the admission code. A send
 * the learner pressed before this code loaded is admitted once it mounts.
 */
export function LiveNinaComposer({
  held,
}: {
  held: PromptInputMessage | null;
}) {
  const client = useLiveSession((state) => state.client);
  if (Option.isNone(client)) {
    return null;
  }
  return (
    <ConvexProvider client={client.value}>
      <LiveNinaAdmission held={held} />
    </ConvexProvider>
  );
}

/** Sends the composer's prompt through admission, then opens the new chat. */
function LiveNinaAdmission({ held }: { held: PromptInputMessage | null }) {
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
      {prompt ? <NinaPromptTurn prompt={prompt} /> : null}
    </NinaInput>
  );
}
