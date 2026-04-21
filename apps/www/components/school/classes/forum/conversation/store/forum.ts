import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils/posts";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { areConversationViewsEqual } from "@/components/school/classes/forum/conversation/utils/view";

export interface ReactionWithUsers {
  count: number;
  emoji: string;
  reactors: string[];
}

export interface ForumPost extends Doc<"schoolClassForumPosts"> {
  attachments: PostAttachment[];
  isUnread?: boolean;
  myReactions: string[];
  reactionUsers: ReactionWithUsers[];
  replyToUser: UserData | null;
  user: UserData | null;
}

interface ReplyTo {
  postId: Id<"schoolClassForumPosts">;
  userName: string;
}

export type ForumConversationView =
  | {
      kind: "bottom";
    }
  | {
      kind: "post";
      offset: number;
      postId: Id<"schoolClassForumPosts">;
    };

interface PersistedForumState {
  savedConversationViews: Partial<
    Record<Id<"schoolClassForums">, ForumConversationView>
  >;
}

interface State {
  conversationSessionVersions: Partial<Record<Id<"schoolClassForums">, number>>;
  isHydrated: boolean;
  replyTo: ReplyTo | null;
  savedConversationViews: Partial<
    Record<Id<"schoolClassForums">, ForumConversationView>
  >;
}

interface Actions {
  clearTransientConversationState: () => void;
  restartConversationSession: (forumId: Id<"schoolClassForums">) => void;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type ForumStore = State & Actions;

const initialState: State = {
  conversationSessionVersions: {},
  isHydrated: false,
  savedConversationViews: {},
  replyTo: null,
};

/**
 * Creates one class-scoped forum UI store with transient interaction state and
 * session-backed conversation snapshots for real remounts.
 */
export const createForumStore = (classId: string) => {
  let syncHydrationState: ((isHydrated: boolean) => void) | null = null;

  const store = createStore<ForumStore>()(
    persist(
      immer((set, get) => {
        syncHydrationState = (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        };

        return {
          ...initialState,

          clearTransientConversationState: () =>
            set({
              replyTo: initialState.replyTo,
            }),

          setReplyTo: (replyTo) => set({ replyTo }),

          restartConversationSession: (forumId) =>
            set((state) => {
              state.conversationSessionVersions[forumId] =
                (state.conversationSessionVersions[forumId] ?? 0) + 1;
            }),

          saveConversationView: (forumId, view) => {
            const savedView = get().savedConversationViews[forumId];

            if (areConversationViewsEqual(savedView, view)) {
              return;
            }

            set((state) => {
              state.savedConversationViews[forumId] = view;
            });
          },
        };
      }),
      {
        migrate: (persistedState, version) => {
          if (
            version >= 7 ||
            !persistedState ||
            typeof persistedState !== "object"
          ) {
            return persistedState as PersistedForumState;
          }

          return {
            // Reset one time so stale transcript anchors from earlier runtime
            // iterations cannot keep restoring the user to the wrong message.
            savedConversationViews: {},
          } satisfies PersistedForumState;
        },
        name: `forum-ui:${classId}`,
        onRehydrateStorage: () => () => {
          syncHydrationState?.(true);
        },
        partialize: (state): PersistedForumState => ({
          savedConversationViews: state.savedConversationViews,
        }),
        storage: createJSONStorage(() => sessionStorage),
        version: 7,
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
};
