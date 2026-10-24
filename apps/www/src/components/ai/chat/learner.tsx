import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PropsWithChildren } from "react";
import { ChatProvider } from "@/components/ai/chat/context";
import { ChatFeedContext, useLiveChatFeed } from "@/components/ai/chat/feed";

/**
 * The live feed of a learner's chat. Only the transcript below it reads the
 * feed, so a streamed batch renders the transcript and nothing that reads the
 * chat's state.
 */
function LiveChatFeed({ children }: PropsWithChildren) {
  const feed = useLiveChatFeed();
  return <ChatFeedContext value={feed}>{children}</ChatFeedContext>;
}

/**
 * A learner's conversation, live: its state comes from the Convex chat, and its
 * messages stream from Agent. The page and the sheet both provide it, so a
 * learner's transcript reads the same contexts wherever it opens.
 */
export function LearnerChatProvider({
  chatId,
  children,
  shareToken,
}: PropsWithChildren<{
  chatId: Id<"chats">;
  shareToken?: string | undefined;
}>) {
  return (
    <ChatProvider chatId={chatId} shareToken={shareToken}>
      <LiveChatFeed>{children}</LiveChatFeed>
    </ChatProvider>
  );
}
