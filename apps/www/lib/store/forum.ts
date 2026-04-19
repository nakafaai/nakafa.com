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

/** Normalizes one legacy persisted conversation view into the new bottom-or-post model. */
function migrateConversationView(
  view: unknown
): ForumConversationView | undefined {
  if (!view || typeof view !== "object") {
    return;
  }

  const value = view as Record<string, unknown>;

  if (value.kind === "bottom") {
    return { kind: "bottom" };
  }

  if (value.kind === "post" && typeof value.postId === "string") {
    return {
      kind: "post",
      offset: typeof value.offset === "number" ? value.offset : 0,
      postId: value.postId as Id<"schoolClassForumPosts">,
    };
  }

  if (
    (value.kind === "header" ||
      value.kind === "date" ||
      value.kind === "unread") &&
    typeof value.postId === "string"
  ) {
    return {
      kind: "post",
      offset: typeof value.offset === "number" ? value.offset : 0,
      postId: value.postId as Id<"schoolClassForumPosts">,
    };
  }

  return;
}

interface State {
  conversationSessionVersions: Partial<Record<Id<"schoolClassForums">, number>>;
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
  savedConversationViews: {},
  replyTo: null,
};

/**
 * Creates one class-scoped forum UI store with transient interaction state and
 * session-backed conversation snapshots for real remounts.
 */
export const createForumStore = (classId: string) =>
  createStore<ForumStore>()(
    persist(
      immer((set, get) => ({
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
      })),
      {
        migrate: (persistedState, version) => {
          if (
            version >= 2 ||
            !persistedState ||
            typeof persistedState !== "object"
          ) {
            return persistedState as PersistedForumState;
          }

          const savedConversationViews =
            (persistedState as PersistedForumState).savedConversationViews ??
            {};
          const nextViews: PersistedForumState["savedConversationViews"] = {};

          for (const [forumId, view] of Object.entries(
            savedConversationViews
          )) {
            const nextView = migrateConversationView(view);

            if (!nextView) {
              continue;
            }

            nextViews[forumId as Id<"schoolClassForums">] = nextView;
          }

          return {
            savedConversationViews: nextViews,
          } satisfies PersistedForumState;
        },
        name: `forum-ui:${classId}`,
        partialize: (state): PersistedForumState => ({
          savedConversationViews: state.savedConversationViews,
        }),
        storage: createJSONStorage(() => sessionStorage),
        version: 2,
      }
    )
  );
