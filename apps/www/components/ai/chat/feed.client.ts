"use client";

import { Ref } from "@confect/core";
import { type UIMessagesQuery, useUIMessages } from "@convex-dev/agent/react";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChat } from "@/components/ai/chat/context";
import { mergeMessages } from "@/components/ai/chat/messages";
import { useAi } from "@/components/ai/context";

// Agent owns delta decoding, reconnection and pagination. Confect registers
// and authorizes the query; the streaming hook uses the SDK reference boundary.
type MessageFeed = UIMessagesQuery<
  Pick<Ref.Args<typeof nina.messages.list>, "chatId">,
  NinaMessage
>;
type MessagesQuery = FunctionReference<
  "query",
  "public",
  FunctionArgs<MessageFeed>,
  FunctionReturnType<MessageFeed> &
    Required<Pick<FunctionReturnType<MessageFeed>, "streams">>
>;
const messagesQuery: MessagesQuery = Ref.getFunctionReference(
  nina.messages.list
);

/**
 * The transcript's messages, streamed by Agent. Only the transcript calls it:
 * every streamed batch renders the component that does, and no control that
 * reads the chat's state. A chat the learner just started shows its first
 * prompt from the receipt, and a prompt they just sent shows at once, until
 * the feed carries the saved ones.
 */
export function useChatFeed() {
  const chatId = useChat((state) => state.chatId);
  const chat = useChat((state) => state.chat);
  const draft = useChat((state) => state.draft);
  const openingChat = useAi((state) => state.openingChat);
  const setOpeningChat = useAi((state) => state.setOpeningChat);
  const feed = useUIMessages(
    messagesQuery,
    chat?.threadId ? { chatId, threadId: chat.threadId } : "skip",
    { initialNumItems: NINA_MESSAGES_PAGE_SIZE, stream: true }
  );
  const loading = !chat || feed.status === "LoadingFirstPage";
  const opening = openingChat?.receipt.chatId === chatId ? openingChat : null;

  // The receipt is only a stand-in until the feed loads.
  useEffect(() => {
    if (opening && !loading) {
      setOpeningChat(null);
    }
  }, [opening, loading, setOpeningChat]);

  // Older messages load through one function that reads the latest feed, so
  // the row that holds it renders when a page is there to load, not per batch.
  const latest = useRef(feed);
  useLayoutEffect(() => {
    latest.current = feed;
  });
  const [loadMore] = useState(
    () => () => latest.current.loadMore(NINA_MESSAGES_PAGE_SIZE)
  );

  return {
    canLoadMore: feed.status === "CanLoadMore",
    loadMore,
    messages: mergeMessages({
      draft,
      loading,
      opening,
      results: feed.results,
    }),
  };
}
