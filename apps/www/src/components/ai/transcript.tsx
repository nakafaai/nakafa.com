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
import { cn } from "cn";
import { Array as Arr, Effect, Fiber, Option } from "effect";
import { memo, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { useChat } from "@/components/ai/chat/context";
import { useChatFeed } from "@/components/ai/chat/feed";
import { hasFailedReply, hasReply } from "@/components/ai/chat/messages";
import { AiChatPending } from "@/components/ai/chat/pending";
import { AiChatError } from "@/components/ai/chat/retry";
import { LastMessageContext } from "@/components/ai/message/last";
import { sameRow } from "@/components/ai/message/row";
import { AiChatMessage } from "@/components/ai/message/view";
import { pageRowVariants } from "@/components/shared/content/width";
import { KeepPlace, useKeptPlace } from "@/components/shared/place";

/**
 * Agent supplies messages; shadcn preserves the reader's position. This is the
 * one place that reads the streamed messages, so a streamed batch renders it
 * and its rows, and nothing else in the chat.
 *
 * A chat opens at its end, as a chat app opens, or where the reader left it in
 * this browser (`KeepPlace`) while no turn runs. A reader at the end stays there
 * while the answers draw more as their Markdown, pictures and fonts arrive, a
 * reader who scrolled up stays where they are, and a new turn anchors its
 * question at the top while the answer streams under it.
 */
export function NinaTranscript() {
  const busy = useChat((state) => state.busy);
  const chatId = useChat((state) => state.chatId);
  const order = useChat((state) => state.turn?.order);
  const { canLoadMore, loadMore, messages } = useChatFeed();
  const t = useTranslations("Ai");
  const chat = `nina:${chatId}`;
  const kept = useKeptPlace(chat);
  const viewport = useRef<HTMLDivElement>(null);

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
    <Primitive.Provider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label={t("messages")} ref={viewport}>
          <MessageScrollerContent
            aria-busy={busy}
            className={cn(pageRowVariants(), "py-6")}
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
        <MessageScrollerButton label={t("scroll-to-latest")} />
      </MessageScroller>
      {/* The place is brought back once the first messages are drawn, which the feed streams in after the chat opens. */}
      {Arr.isReadonlyArrayEmpty(messages) ? null : (
        <KeepPlace
          chat={chat}
          restore={busy ? Option.none() : kept}
          viewport={viewport}
        />
      )}
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
