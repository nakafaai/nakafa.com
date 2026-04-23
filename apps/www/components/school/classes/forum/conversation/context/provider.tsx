import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo, type ReactNode, useMemo, useRef } from "react";
import { ControlsProvider } from "@/components/school/classes/forum/conversation/context/use-controls";
import { DataProvider } from "@/components/school/classes/forum/conversation/context/use-data";
import { ViewportProvider } from "@/components/school/classes/forum/conversation/context/use-viewport";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { createViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

/** Wires immutable forum data and UI-intent state into selector contexts. */
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
    const viewportStoreRef = useRef<{
      forumId: Id<"schoolClassForums">;
      store: ReturnType<typeof createViewportStore>;
    } | null>(null);

    /*
     * The forum panel route stays mounted while the selected `forumId` changes
     * inside the same parallel-route slot. Recreating the per-forum viewport
     * store here keeps that reset scoped to the state boundary itself instead
     * of relying on an outer JSX `key`.
     *
     * References:
     * - https://react.dev/learn/preserving-and-resetting-state
     * - https://react.dev/learn/you-might-not-need-an-effect
     */
    if (viewportStoreRef.current?.forumId !== forumId) {
      viewportStoreRef.current = {
        forumId,
        store: createViewportStore(),
      };
    }

    const viewportStore = viewportStoreRef.current.store;
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
        <ViewportProvider store={viewportStore}>
          <ControlsProvider>{children}</ControlsProvider>
        </ViewportProvider>
      </DataProvider>
    );
  }
);
ConversationProvider.displayName = "ConversationProvider";
