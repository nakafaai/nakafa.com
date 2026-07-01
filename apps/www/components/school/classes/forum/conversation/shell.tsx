import type { Id } from "@repo/backend/convex/_generated/dataModel";

import { ForumConversationBody } from "@/components/school/classes/forum/conversation/body";
import { DataProvider } from "@/components/school/classes/forum/conversation/context/use-data";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";

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
    <DataProvider
      value={{
        currentUserId,
        forum,
        forumId,
      }}
    >
      <ForumConversationBody />
    </DataProvider>
  );
}
