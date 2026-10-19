"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Intersection } from "@repo/design-system/components/ui/intersection";
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
import { Array as Arr, Effect, Fiber } from "effect";
import { useTranslations } from "next-intl";
import { memo, useEffect } from "react";
import { useChat } from "@/components/ai/chat/context";
import { AiChatError } from "@/components/ai/chat/error";
import { useChatFeed } from "@/components/ai/chat/feed.client";
import { hasFailedReply, hasReply } from "@/components/ai/chat/messages";
import { AiChatPending } from "@/components/ai/chat/pending";
import { LastMessageContext } from "@/components/ai/message/last.client";
import { sameRow } from "@/components/ai/message/row";
import { AiChatMessage } from "@/components/ai/message/view";

/**
 * Agent supplies messages; shadcn preserves the reader's position. This is the
 * one place that reads the streamed messages, so a streamed batch renders it
 * and its rows, and nothing else in the chat.
 */
export function NinaTranscript() {
  const busy = useChat((state) => state.busy);
  const order = useChat((state) => state.turn?.order);
  const { canLoadMore, loadMore, messages } = useChatFeed();
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
            {Arr.map(messages, (message, index) => (
              <TranscriptRow
                key={message.key}
                last={index === messages.length - 1}
                loadMore={index === 0 && canLoadMore ? loadMore : undefined}
                message={message}
              />
            ))}
            <AiChatPending replied={hasReply(messages, order)} />
            <AiChatError failed={hasFailedReply(messages, order)} />
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("scroll-to-latest")} />
      </MessageScroller>
    </Primitive.Provider>
  );
}

/**
 * One message of the transcript. The first row loads older messages when it
 * comes near the reader, while more are there to load. A row renders again only
 * when its message says something new, so a streamed batch leaves the settled
 * rows as they are.
 */
const TranscriptRow = memo(function TranscriptRow({
  last,
  loadMore,
  message,
}: {
  last: boolean;
  loadMore: (() => void) | undefined;
  message: NinaMessage;
}) {
  return (
    <LastMessageContext value={last}>
      <MessageScrollerItem
        messageId={message.key}
        scrollAnchor={message.role === "user"}
      >
        {loadMore ? <Intersection onIntersect={loadMore} /> : null}
        <Message align={message.role === "user" ? "end" : "start"}>
          <AiChatMessage message={message} />
        </Message>
      </MessageScrollerItem>
    </LastMessageContext>
  );
}, sameRow);
