"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo } from "react";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/index";
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

    if (!user) {
      return null;
    }

    return (
      <ForumPostConversation
        currentUserId={user.appUser._id}
        forum={forum}
        forumId={forumId}
      />
    );
  }
);
SchoolClassesForumPanelContent.displayName = "SchoolClassesForumPanelContent";
