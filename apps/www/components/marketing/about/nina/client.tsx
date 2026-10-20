"use client";

import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Message } from "@repo/design-system/components/ui/message";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { useRouter } from "@repo/internationalization/src/navigation";
import type { ComponentProps } from "react";
import {
  useAdmissionGate,
  useChatAdmission,
} from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { useLiveSession } from "@/components/providers/marketing";

type ComposerPrompt = ReturnType<typeof useChatAdmission>["prompt"];
type ComposerSubmit = ComponentProps<typeof NinaInput>["onSubmit"];

/** The prompt that is on its way, then the input that sends the next one. */
function Composer({
  disabled,
  onSubmit,
  prompt,
}: {
  disabled: boolean;
  onSubmit: ComposerSubmit;
  prompt: ComposerPrompt;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {prompt ? (
        <>
          <Message align="end">
            <NinaPrompt files={prompt.files}>
              <DeferredLearnerText>{prompt.text}</DeferredLearnerText>
            </NinaPrompt>
          </Message>
          {/* The prompt is on its way: show the turn as started, as the page's new chat does. */}
          <Message>
            <TypingLoader />
          </Message>
        </>
      ) : null}
      <NinaInput disabled={disabled} onSubmit={onSubmit} />
    </div>
  );
}

/** A signed-in account's composer: its prompt starts a chat through admission. */
function LiveNinaComposer() {
  const router = useRouter();
  const { disabled, prompt, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return <Composer disabled={disabled} onSubmit={submit} prompt={prompt} />;
}

/**
 * A visitor's composer. Its prompt waits at sign-in, so the page loads no chat
 * submission code, and the typed text stays in the input until it is admitted.
 */
function VisitorNinaComposer() {
  const { admit } = useAdmissionGate();

  return <Composer disabled={false} onSubmit={admit} prompt={null} />;
}

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const live = useLiveSession();
  return live ? <LiveNinaComposer /> : <VisitorNinaComposer />;
}
