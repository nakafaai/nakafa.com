"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";

import { ConversationProvider } from "@/components/school/classes/forum/conversation/context/provider";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ForumConversationViewport } from "@/components/school/classes/forum/conversation/viewport";

/** Renders the forum conversation shell around the extracted controller state. */
export function ForumPostConversation({
  forum,
  forumId,
  currentUserId,
}: {
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
  currentUserId: Id<"users">;
}) {
  return (
    <ConversationProvider
      currentUserId={currentUserId}
      forum={forum}
      forumId={forumId}
    >
      <ConversationBody />
    </ConversationProvider>
  );
}

function ConversationBody() {
  return (
    <div className="flex size-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ForumConversationViewport />
      </div>
      <ForumPostInput />
    </div>
  );
}
