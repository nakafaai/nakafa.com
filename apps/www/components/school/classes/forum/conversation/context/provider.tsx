import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { DataProvider } from "@/components/school/classes/forum/conversation/context/use-data";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";

/** Wires immutable forum data into the Forum Conversation subtree. */
export function ConversationProvider({
  children,
  currentUserId,
  forum,
  forumId,
}: {
  children: ReactNode;
  currentUserId: Id<"users">;
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}) {
  const data = {
    currentUserId,
    forum,
    forumId,
  };

  return <DataProvider value={data}>{children}</DataProvider>;
}
