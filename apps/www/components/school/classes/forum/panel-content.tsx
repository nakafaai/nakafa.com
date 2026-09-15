"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";

import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/shell";
import { useAccount } from "@/lib/identity/client";

export function SchoolClassesForumPanelContent({
  forum,
  forumId,
}: {
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}) {
  const user = useAccount((state) => state.user);

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
