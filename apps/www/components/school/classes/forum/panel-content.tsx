"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo } from "react";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { useForum } from "@/lib/context/use-forum";
import { useUser } from "@/lib/context/use-user";

export const SchoolClassesForumPanelContent = memo(
  ({
    forum,
    forumId,
  }: {
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
  }) => {
    const user = useUser((state) => state.user);
    const conversationSessionVersion = useForum(
      (state) => state.conversationSessionVersions[forumId] ?? 0
    );

    if (!user) {
      return null;
    }

    return (
      <ForumPostConversation
        currentUserId={user.appUser._id}
        forum={forum}
        forumId={forumId}
        key={`${forumId}:${conversationSessionVersion}`}
      />
    );
  }
);
SchoolClassesForumPanelContent.displayName = "SchoolClassesForumPanelContent";
