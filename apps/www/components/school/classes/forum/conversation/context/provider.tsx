import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type ReactNode, useState } from "react";
import { ControlsProvider } from "@/components/school/classes/forum/conversation/context/use-controls";
import { DataProvider } from "@/components/school/classes/forum/conversation/context/use-data";
import { ViewportProvider } from "@/components/school/classes/forum/conversation/context/use-viewport";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import { createViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

/** Wires immutable forum data and UI-intent state into selector contexts. */
export const ConversationProvider = ({
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
  const [viewportStoreState, setViewportStoreState] = useState(() => ({
    forumId,
    store: createViewportStore(),
  }));

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
  let currentViewportStoreState = viewportStoreState;

  if (viewportStoreState.forumId !== forumId) {
    currentViewportStoreState = {
      forumId,
      store: createViewportStore(),
    };
    setViewportStoreState(currentViewportStoreState);
  }

  const viewportStore = currentViewportStoreState.store;
  const data = {
    currentUserId,
    forum,
    forumId,
  };

  return (
    <DataProvider value={data}>
      <ViewportProvider store={viewportStore}>
        <ControlsProvider>{children}</ControlsProvider>
      </ViewportProvider>
    </DataProvider>
  );
};
ConversationProvider.displayName = "ConversationProvider";
