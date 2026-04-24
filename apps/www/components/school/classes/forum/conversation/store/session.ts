import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CacheSnapshot } from "virtua";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ReplyTo } from "@/components/school/classes/forum/conversation/data/entities";

export interface ConversationScrollSnapshot {
  cache: CacheSnapshot | null;
  lastPostId: Id<"schoolClassForumPosts"> | null;
  offset: number;
  renderedRowCount: number;
  wasAtBottom: boolean;
}

interface State {
  isHydrated: boolean;
  replyTo: ReplyTo | null;
  savedConversationScrollSnapshots: Partial<
    Record<Id<"schoolClassForums">, ConversationScrollSnapshot>
  >;
}

interface Actions {
  saveConversationScrollSnapshot: (
    forumId: Id<"schoolClassForums">,
    snapshot: ConversationScrollSnapshot
  ) => void;
  setHydrated: (isHydrated: boolean) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type SessionStore = State & Actions;

const initialState: State = {
  isHydrated: false,
  replyTo: null,
  savedConversationScrollSnapshots: {},
};

/** Returns whether one stored cache snapshot still matches the current list. */
export function canRestoreConversationScrollCache({
  lastPostId,
  renderedRowCount,
  snapshot,
}: {
  lastPostId: Id<"schoolClassForumPosts"> | null;
  renderedRowCount: number;
  snapshot: ConversationScrollSnapshot | null | undefined;
}) {
  if (!snapshot?.cache) {
    return false;
  }

  return (
    snapshot.lastPostId === lastPostId &&
    snapshot.renderedRowCount === renderedRowCount
  );
}

/**
 * Creates one class-scoped session store for reply state and scroll restoration.
 *
 * Hydration is intentionally manual so the conversation provider can rehydrate
 * session-backed state on the client before the transcript renders.
 */
export function createSessionStore(classId: string) {
  return createStore<SessionStore>()(
    persist(
      immer((set) => ({
        ...initialState,

        saveConversationScrollSnapshot: (forumId, snapshot) => {
          set((state) => {
            state.savedConversationScrollSnapshots[forumId] = snapshot;
          });
        },

        setHydrated: (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        },

        setReplyTo: (replyTo) => {
          set((state) => {
            state.replyTo = replyTo;
          });
        },
      })),
      {
        name: `nakafa-forum-session:${classId}`,
        partialize: (state) => ({
          savedConversationScrollSnapshots:
            state.savedConversationScrollSnapshots,
        }),
        skipHydration: true,
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      }
    )
  );
}
