"use client";

import { Message } from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { useTranslations } from "next-intl";
import { AiChatError } from "@/components/ai/chat-error";
import { AiChatMessage } from "@/components/ai/chat-message";
import { AiChatPending } from "@/components/ai/chat-pending";
import { useChat } from "@/components/ai/context/use-chat";
import { AiChatPaginationTrigger } from "@/components/ai/pagination-trigger";

/** Agent supplies messages; shadcn preserves the reader's position. */
export function NinaTranscript() {
  const { messages, busy } = useChat((state) => state);
  const t = useTranslations("Ai");
  return (
    <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label={t("messages")}>
          <MessageScrollerContent
            aria-busy={busy}
            className="mx-auto w-full max-w-3xl p-6"
          >
            {messages.map((message, index) => (
              <MessageScrollerItem
                key={message.key}
                messageId={message.key}
                scrollAnchor={message.role === "user"}
              >
                {index === 0 ? <AiChatPaginationTrigger /> : null}
                <Message align={message.role === "user" ? "end" : "start"}>
                  <AiChatMessage message={message} />
                </Message>
              </MessageScrollerItem>
            ))}
            <AiChatPending />
            <AiChatError />
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("scroll-to-latest")} />
      </MessageScroller>
    </Primitive.Provider>
  );
}
