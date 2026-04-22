import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo, type ReactNode, useMemo, useState } from "react";
import { DataProvider } from "@/components/school/classes/forum/conversation/context/use-data";
import { ViewportProvider } from "@/components/school/classes/forum/conversation/context/use-viewport";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { createViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

/** Wires conversation data and viewport state into their providers. */
export const ConversationProvider = memo(
  ({
    children,
    currentUserId,
    forum,
    forumId,
  }: {
    children: ReactNode;
    currentUserId: Id<"users">;
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
  }) => {
    const [viewportStore] = useState(() => createViewportStore());
    const data = useMemo(
      () => ({
        currentUserId,
        forum,
        forumId,
      }),
      [currentUserId, forum, forumId]
    );

    return (
      <DataProvider value={data}>
        <ViewportProvider store={viewportStore}>{children}</ViewportProvider>
      </DataProvider>
    );
  }
);
ConversationProvider.displayName = "ConversationProvider";
