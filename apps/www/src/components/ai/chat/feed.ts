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
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { readChatArgs } from "@/components/ai/chat/access";
import { useChat } from "@/components/ai/chat/context";
import { mergeMessages } from "@/components/ai/chat/messages";
import { canLoadOlderMessages } from "@/components/ai/chat/turns";
import { useAi } from "@/components/ai/context";

// Agent owns delta decoding, reconnection and pagination. Confect registers
// and authorizes the query; the streaming hook uses the SDK reference boundary.
type MessageFeed = UIMessagesQuery<
  Pick<Ref.Args<typeof nina.messages.page>, "chatId" | "shareToken">,
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
  nina.messages.page
);

/**
 * The messages a transcript shows and the way to load older ones. A learner's
 * chat streams them from Agent (`LiveChatFeed`). A reader's chat holds the pages
 * the server read (`ReaderChatPage`), so the message components read one shape
 * whichever it is.
 */
export const ChatFeedContext = createContext<ReturnType<
  typeof useLiveChatFeed
> | null>(null);

/** The messages of the chat the transcript shows, from whichever feed provides them. */
export function useChatFeed() {
  const feed = use(ChatFeedContext);
  if (!feed) {
    throw new Error("useChatFeed must be used within a chat feed");
  }
  return feed;
}

/**
 * The transcript's messages, streamed by Agent. A chat the learner just started
 * shows its first prompt from the receipt, and a prompt they just sent shows at
 * once, until the feed carries the saved ones. The messages carry nothing of
 * their turns, which the conversation tells, so the transcript waits for the
 * first page of those too, and an older page of messages loads with an older
 * page of turns.
 */
export function useLiveChatFeed() {
  const chatId = useChat((state) => state.chatId);
  const shareToken = useChat((state) => state.shareToken);
  const chat = useChat((state) => state.chat);
  const draft = useChat((state) => state.draft);
  const loadMoreTurns = useChat((state) => state.loadMoreTurns);
  const turnsLoading = useChat((state) => state.turnsLoading);
  const turnsStatus = useChat((state) => state.turnsStatus);
  const openingChat = useAi((state) => state.openingChat);
  const setOpeningChat = useAi((state) => state.setOpeningChat);
  const feed = useUIMessages(
    messagesQuery,
    chat?.threadId
      ? { ...readChatArgs(chatId, shareToken), threadId: chat.threadId }
      : "skip",
    { initialNumItems: NINA_MESSAGES_PAGE_SIZE, stream: true }
  );
  const loading = !chat || turnsLoading || feed.status === "LoadingFirstPage";
  const opening = openingChat?.receipt.chatId === chatId ? openingChat : null;

  // The receipt is only a stand-in until the feed loads.
  useEffect(() => {
    if (opening && !loading) {
      setOpeningChat(null);
    }
  }, [opening, loading, setOpeningChat]);

  // Older messages load through one function that reads the latest feed, so
  // the row that holds it renders when a page is there to load, not per batch.
  // `loadMoreTurns` exists only while the turns have more, so a page of turns
  // loads only then.
  const latest = useRef({ feed, loadMoreTurns });
  useLayoutEffect(() => {
    latest.current = { feed, loadMoreTurns };
  });
  const [loadMore] = useState(() => () => {
    latest.current.feed.loadMore(NINA_MESSAGES_PAGE_SIZE);
    latest.current.loadMoreTurns?.();
  });

  return {
    canLoadMore: canLoadOlderMessages(feed.status, turnsStatus),
    loadMore,
    messages: mergeMessages({
      draft,
      loading,
      opening,
      results: feed.results,
    }),
  };
}
