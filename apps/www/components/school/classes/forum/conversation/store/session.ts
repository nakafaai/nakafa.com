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
  rowCount: number;
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

/** Returns whether one stored scroll snapshot still matches the current list. */
export function canRestoreConversationScrollSnapshot({
  lastPostId,
  rowCount,
  snapshot,
}: {
  lastPostId: Id<"schoolClassForumPosts"> | null;
  rowCount: number;
  snapshot: ConversationScrollSnapshot | null | undefined;
}) {
  if (!snapshot) {
    return false;
  }

  return snapshot.lastPostId === lastPostId && snapshot.rowCount === rowCount;
}

/** Creates one class-scoped session store for reply state and scroll restoration. */
export function createSessionStore(classId: string) {
  const store = createStore<SessionStore>()(
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
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      }
    )
  );

  if (store.persist.hasHydrated()) {
    store.setState((state) => ({
      ...state,
      isHydrated: true,
    }));
  }

  return store;
}
