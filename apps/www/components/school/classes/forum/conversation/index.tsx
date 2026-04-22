"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo } from "react";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ConversationProvider } from "@/components/school/classes/forum/conversation/provider";
import { ForumConversationViewport } from "@/components/school/classes/forum/conversation/viewport";

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

const ConversationBody = memo(() => (
  <div className="flex size-full flex-col overflow-hidden">
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <ForumConversationViewport />
    </div>
    <ForumPostInput />
  </div>
));
ConversationBody.displayName = "ConversationBody";
