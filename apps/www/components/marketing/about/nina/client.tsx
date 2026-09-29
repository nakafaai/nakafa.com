"use client";

import { MarkdownFrame } from "@repo/design-system/components/markdown/frame";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Message } from "@repo/design-system/components/ui/message";
import { useRouter } from "@repo/internationalization/src/navigation";
import { lazy, Suspense } from "react";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

// The homepage loads the streaming Markdown renderer only after a real send.
const Response = lazy(() =>
  import("@repo/design-system/components/ai/response").then((module) => ({
    default: module.Response,
  }))
);

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const router = useRouter();
  const { disabled, prompt, promptId, submit } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {prompt ? (
        <Message align="end">
          <NinaPrompt files={prompt.files}>
            {/* A plain prompt renders the same paragraph while the renderer loads. */}
            <Suspense
              fallback={
                <MarkdownFrame variant="chat">
                  <Paragraph data-nakafa="paragraph">{prompt.text}</Paragraph>
                </MarkdownFrame>
              }
            >
              <Response id={promptId}>{prompt.text}</Response>
            </Suspense>
          </NinaPrompt>
        </Message>
      ) : null}
      <NinaInput disabled={disabled} onSubmit={submit} />
    </div>
  );
}
