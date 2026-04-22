"use client";

import { memo } from "react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { ForumConversationTranscript } from "@/components/school/classes/forum/conversation/transcript";

/** Renders the live transcript viewport with one simple latest button. */
export const ForumConversationViewport = memo(() => {
  const forum = useData((state) => state.forum);
  const hasPendingLatestPosts = useViewport(
    (state) => state.hasPendingLatestPosts
  );
  const isAtBottom = useViewport((state) => state.isAtBottom);
  const shouldShowJumpBar = hasPendingLatestPosts || !isAtBottom;

  if (!forum) {
    return null;
  }

  return (
    <>
      <ForumConversationTranscript />
      {shouldShowJumpBar ? <JumpBar /> : null}
    </>
  );
});
ForumConversationViewport.displayName = "ForumConversationViewport";
