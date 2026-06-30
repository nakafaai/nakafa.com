import type { Id } from "@repo/backend/convex/_generated/dataModel";

import { ForumConversationBody } from "@/components/school/classes/forum/conversation/body";
import { ConversationProvider } from "@/components/school/classes/forum/conversation/context/provider";
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
  return <ForumConversationBody />;
}
