import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { enableMapSet } from "immer";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createHistoryActions } from "@/components/school/classes/forum/conversation/store/runtime/history-actions";
import { createPagingActions } from "@/components/school/classes/forum/conversation/store/runtime/paging-actions";
import { createInitialRuntimeState } from "@/components/school/classes/forum/conversation/store/runtime/state";
import { createSyncActions } from "@/components/school/classes/forum/conversation/store/runtime/sync-actions";
import type {
  ConversationRuntimeDeps,
  ConversationRuntimeStore,
} from "@/components/school/classes/forum/conversation/store/runtime/types";

enableMapSet();

/** Creates one forum-scoped runtime store for transcript state and navigation intent. */
export function createConversationStore({
  currentUserId,
  forumId,
  getDeps,
  prefersReducedMotion,
}: {
  currentUserId: Id<"users">;
  forumId: Id<"schoolClassForums">;
  getDeps: () => ConversationRuntimeDeps;
  prefersReducedMotion: boolean;
}) {
  return createStore<ConversationRuntimeStore>()(
    immer((set, get) => {
      const context = { get, getDeps, set };

      return {
        ...createInitialRuntimeState({
          currentUserId,
          forumId,
          prefersReducedMotion,
        }),
        ...createSyncActions(context),
        ...createHistoryActions(context),
        ...createPagingActions(context),
      };
    })
  );
}
