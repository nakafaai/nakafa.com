"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { memo } from "react";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation";
import { useForum } from "@/lib/context/use-forum";

// ============================================================================
// Main Export
// ============================================================================

export const SchoolClassesForumPostSheetContent = memo(() => {
  const activeForumId = useForum((f) => f.activeForumId);

  if (!activeForumId) {
    return null;
  }

  return <ForumPostList forumId={activeForumId} />;
});
SchoolClassesForumPostSheetContent.displayName =
  "SchoolClassesForumPostSheetContent";

// ============================================================================
// ForumPostList
// ============================================================================

const ForumPostList = memo(
  ({ forumId }: { forumId: Id<"schoolClassForums"> }) => {
    const currentUser = useQuery(api.auth.getCurrentUser);
    // getForum now includes lastReadAt - single query instead of two
    const forum = useQuery(api.classes.queries.getForum, { forumId });

    if (!(forum && currentUser)) {
      return null;
    }

    return (
      <ForumPostConversation
        currentUserId={currentUser.appUser._id}
        forum={forum}
        lastReadAt={forum.lastReadAt ?? 0}
      />
    );
  }
);
ForumPostList.displayName = "ForumPostList";
