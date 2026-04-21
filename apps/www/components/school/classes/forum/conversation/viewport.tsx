"use client";

import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";
import { ForumConversationTranscript } from "@/components/school/classes/forum/conversation/transcript";
import { ForumConversationTranscriptPlaceholder } from "@/components/school/classes/forum/conversation/transcript/rows";

/** Renders the transcript viewport and contextual jump actions. */
export function ForumConversationViewport() {
  const forum = useConversation((state) => state.forum);
  const hasPendingLatestPosts = useConversation(
    (state) => state.hasPendingLatestPosts
  );
  const isAtBottom = useConversation((state) => state.isAtBottom);
  const isAtLatestEdge = useConversation((state) => state.isAtLatestEdge);
  const isInitialLoading = useConversation((state) => state.isInitialLoading);
  const canGoBack = useConversation((state) => state.canGoBack);

  if (isInitialLoading || !forum) {
    return <ForumConversationTranscriptPlaceholder />;
  }

  const showJumpLatest =
    hasPendingLatestPosts || !(isAtLatestEdge && isAtBottom);
  const showJumpBack = canGoBack && showJumpLatest;

  return (
    <>
      <ForumConversationTranscript />
      <JumpBar showBack={showJumpBack} showLatest={showJumpLatest} />
    </>
  );
}
