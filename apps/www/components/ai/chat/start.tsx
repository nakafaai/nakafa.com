"use client";

import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Message } from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { useAi } from "@/components/ai/context";
import { NinaPrompt } from "@/components/ai/message/prompt";

/**
 * Starts one new chat, for every surface that offers one: the page and the
 * sheet. It admits the first prompt, and holds the prompt that is on its way
 * so the surface can show it, whether the learner typed it or a page asked it.
 * While a chat is on its way, nothing else can start one.
 */
export function useStartChat(options: Parameters<typeof useChatAdmission>[0]) {
  const admission = useChatAdmission(options);
  const ask = useAi((state) => state.ask);

  return {
    disabled: admission.disabled || ask !== null,
    prompt: admission.prompt
      ? { ...admission.prompt, id: admission.promptId }
      : ask && { ...ask, files: [] },
    submit: admission.submit,
  };
}

/**
 * The scroller of a new chat. Once a prompt is on its way it shows that
 * prompt, with Nina typing after it; until then it shows `children`, the
 * welcome of the surface. `className` places the content on the surface.
 */
export function StartPrompt({
  children,
  className,
  prompt,
}: {
  children?: ReactNode;
  className?: string;
  prompt: ReturnType<typeof useStartChat>["prompt"];
}) {
  const t = useTranslations("Ai");

  return (
    <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label={t("messages")}>
          <MessageScrollerContent className={className}>
            {prompt ? (
              <>
                <MessageScrollerItem messageId={prompt.id} scrollAnchor>
                  <Message align="end">
                    <NinaPrompt files={prompt.files}>
                      <DeferredLearnerText>{prompt.text}</DeferredLearnerText>
                    </NinaPrompt>
                  </Message>
                </MessageScrollerItem>
                <MessageScrollerItem messageId="pending">
                  <Message>
                    <TypingLoader />
                  </Message>
                </MessageScrollerItem>
              </>
            ) : (
              children
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </Primitive.Provider>
  );
}
