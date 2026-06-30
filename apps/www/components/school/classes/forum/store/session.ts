import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";

export interface ForumReplyTarget {
  postId: Id<"schoolClassForumPosts">;
  userName: string;
}

export interface ConversationScrollSnapshot {
  lastPostId: Id<"schoolClassForumPosts"> | null;
  offset: number;
  renderedRowCount: number;
  view: ConversationView;
  wasAtBottom: boolean;
}

interface State {
  conversationScrollSnapshotByForumId: Partial<
    Record<Id<"schoolClassForums">, ConversationScrollSnapshot>
  >;
  isHydrated: boolean;
  replyTargetByForumId: Partial<
    Record<Id<"schoolClassForums">, ForumReplyTarget>
  >;
}

interface Actions {
  saveConversationScrollSnapshot: (
    forumId: Id<"schoolClassForums">,
    snapshot: ConversationScrollSnapshot
  ) => void;
  setForumReplyTarget: (
    forumId: Id<"schoolClassForums">,
    replyTarget: ForumReplyTarget | null
  ) => void;
  setHydrated: (isHydrated: boolean) => void;
}

export type ForumSessionStore = State & Actions;

const initialState: State = {
  isHydrated: false,
  conversationScrollSnapshotByForumId: {},
  replyTargetByForumId: {},
};

const initialPersistedState = {
  conversationScrollSnapshotByForumId: {},
} satisfies Pick<State, "conversationScrollSnapshotByForumId">;

/**
 * Creates one class-scoped session store for forum reply state and scroll restoration.
 *
 * Hydration is intentionally manual so the forum provider can rehydrate
 * session-backed state on the client before the transcript renders.
 */
export function createForumSessionStore(classId: string) {
  return createStore<ForumSessionStore>()(
    persist(
      immer((set) => ({
        ...initialState,

        saveConversationScrollSnapshot: (forumId, snapshot) => {
          set((state) => {
            state.conversationScrollSnapshotByForumId[forumId] = snapshot;
          });
        },

        setHydrated: (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        },

        setForumReplyTarget: (forumId, replyTarget) => {
          set((state) => {
            if (!replyTarget) {
              delete state.replyTargetByForumId[forumId];
              return;
            }

            state.replyTargetByForumId[forumId] = replyTarget;
          });
        },
      })),
      {
        name: `nakafa-forum-session:${classId}`,
        migrate: () => initialPersistedState,
        partialize: (state) => ({
          conversationScrollSnapshotByForumId:
            state.conversationScrollSnapshotByForumId,
        }),
        skipHydration: true,
        storage: createJSONStorage(() => sessionStorage),
        version: 3,
      }
    )
  );
}
