import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type PropsWithChildren, useState } from "react";
import {
  type ChatPaging,
  ChatValueProvider,
  useChatState,
} from "@/components/ai/chat/context";
import { ChatFeedContext, useLiveChatFeed } from "@/components/ai/chat/feed";
import { createChatStore } from "@/components/ai/chat/store";

/**
 * The live feed of a learner's chat. Only the transcript below it reads the
 * feed, so a streamed batch renders the transcript and nothing that reads the
 * chat's state.
 */
function LiveChatFeed({
  children,
  paging,
}: PropsWithChildren<{ paging: ChatPaging }>) {
  const feed = useLiveChatFeed(paging);
  return <ChatFeedContext value={feed}>{children}</ChatFeedContext>;
}

/**
 * A learner's conversation, live: its state comes from the Convex chat, and its
 * messages stream from Agent. The page and the sheet both provide it, so a
 * learner's transcript reads the same contexts wherever it opens. The caller
 * gives the provider a key of the chat's id: the state of one chat lives and
 * ends with that key, so choosing another chat starts with none of the previous
 * chat's error, stop, send or pending prompt. The text the learner is typing is
 * not part of it: that draft is one for every chat. `shareToken` is the one a
 * shared link carries, for a reader who is not the owner.
 */
export function LearnerChatProvider({
  chatId,
  children,
  shareToken,
}: PropsWithChildren<{
  chatId: Id<"chats">;
  shareToken?: string | undefined;
}>) {
  const [store] = useState(createChatStore);
  const { paging, value } = useChatState(chatId, shareToken, store);
  return (
    <ChatValueProvider store={store} value={value}>
      <LiveChatFeed paging={paging}>{children}</LiveChatFeed>
    </ChatValueProvider>
  );
}
