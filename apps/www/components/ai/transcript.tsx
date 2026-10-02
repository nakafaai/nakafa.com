"use client";

import { Message } from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { loadMathFonts } from "@repo/design-system/lib/markdown/fonts";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { Effect, Fiber } from "effect";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useChat, useChatMessages } from "@/components/ai/chat/context";
import { AiChatError } from "@/components/ai/chat/error";
import { AiChatPaginationTrigger } from "@/components/ai/chat/pagination";
import { AiChatPending } from "@/components/ai/chat/pending";
import { AiChatMessage } from "@/components/ai/message/view";

/** Agent supplies messages; shadcn preserves the reader's position. */
export function NinaTranscript() {
  const messages = useChatMessages((feed) => feed.messages);
  const busy = useChat((state) => state.busy);
  const t = useTranslations("Ai");

  // Answers render after the transcript, so their math would otherwise find
  // its fonts missing and reflow the text around it once they arrive.
  useEffect(() => {
    const fiber = Effect.runFork(
      loadMathFonts(document.fonts).pipe(
        // A formula still requests these faces when it first renders.
        Effect.catchTag("MathFontLoadError", () => Effect.void)
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

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
