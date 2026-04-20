"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo } from "react";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import {
  ConversationProvider,
  useConversation,
} from "@/components/school/classes/forum/conversation/provider";
import {
  ForumConversationTranscript,
  ForumConversationTranscriptPlaceholder,
} from "@/components/school/classes/forum/conversation/transcript";
import type { Forum } from "@/components/school/classes/forum/conversation/types";

/** Renders the forum conversation shell around the extracted controller state. */
export const ForumPostConversation = memo(
  ({
    forum,
    forumId,
    currentUserId,
  }: {
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
    currentUserId: Id<"users">;
  }) => (
    <ConversationProvider
      currentUserId={currentUserId}
      forum={forum}
      forumId={forumId}
    >
      <ConversationBody />
    </ConversationProvider>
  )
);
ForumPostConversation.displayName = "ForumPostConversation";

/** Selects shell-level conversation state for the transcript layout. */
function ConversationBody() {
  const forum = useConversation((value) => value.state.forum);
  const isAtBottom = useConversation((value) => value.state.isAtBottom);
  const isAtLatestEdge = useConversation((value) => value.state.isAtLatestEdge);
  const isInitialLoading = useConversation(
    (value) => value.state.isInitialLoading
  );
  const canGoBack = useConversation((value) => value.state.canGoBack);

  if (isInitialLoading || !forum) {
    return <ForumConversationTranscriptPlaceholder />;
  }

  const showJumpLatest = !(isAtLatestEdge && isAtBottom);
  const showJumpBack = canGoBack && showJumpLatest;

  return (
    <div className="flex size-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <ForumConversationTranscript />
        <JumpBar showBack={showJumpBack} showLatest={showJumpLatest} />
      </div>
      <ForumPostInput />
    </div>
  );
}
