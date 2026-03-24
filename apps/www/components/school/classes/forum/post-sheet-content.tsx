"use client";

import { memo } from "react";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { useUser } from "@/lib/context/use-user";

export const SchoolClassesForumPostSheetContent = memo(
  ({ forum }: { forum: Forum | undefined }) => {
    const user = useUser((state) => state.user);

    if (!(forum && user)) {
      return null;
    }

    return (
      <ForumPostConversation
        currentUserId={user.appUser._id}
        forum={forum}
        key={forum._id}
      />
    );
  }
);
SchoolClassesForumPostSheetContent.displayName =
  "SchoolClassesForumPostSheetContent";
