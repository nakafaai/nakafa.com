"use client";

import { Message } from "@repo/design-system/components/ui/message";
import { Particles } from "@repo/design-system/components/ui/particles";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { useRouter } from "@repo/internationalization/src/navigation";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { ChatHeader } from "@/components/ai/chat/header";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

/** Moves directly from the welcome screen into the final conversation layout. */
export function ChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("Ai");
  const { prompt, promptId, submit, disabled } = useChatAdmission({
    onComplete: (chatId) => router.push(`/chat/${chatId}`),
  });

  return (
    <div
      className={cn(
        "relative flex size-full min-w-0 flex-col overflow-hidden text-chat",
        !prompt && "justify-center gap-4"
      )}
    >
      {prompt ? (
        <ChatHeader />
      ) : (
        <>
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 top-0">
            <ChatHeader />
          </div>
        </>
      )}
      {prompt ? (
        <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label={t("messages")}>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl p-6">
                <MessageScrollerItem messageId={promptId} scrollAnchor>
                  <Message align="end">
                    <NinaPrompt
                      files={prompt.files ?? []}
                      id={promptId}
                      text={prompt.text}
                    />
                  </Message>
                </MessageScrollerItem>
                <MessageScrollerItem messageId="pending">
                  <Message>
                    <TypingLoader />
                  </Message>
                </MessageScrollerItem>
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </Primitive.Provider>
      ) : (
        <div className="relative mx-auto w-full max-w-xl px-6">{title}</div>
      )}
      <div
        className={cn(
          "relative mx-auto grid w-full shrink-0",
          prompt ? "max-w-3xl px-4 pb-4" : "max-w-xl px-6"
        )}
        key="composer"
      >
        <NinaInput disabled={disabled} onSubmit={submit} />
      </div>
      {prompt ? null : (
        <div className="relative mx-auto w-full max-w-xl px-6">{children}</div>
      )}
    </div>
  );
}
