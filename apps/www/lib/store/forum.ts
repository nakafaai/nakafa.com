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
      kind: "header";
      offset: number;
      postId: Id<"schoolClassForumPosts"> | null;
    }
  | {
      date: number;
      kind: "date";
      offset: number;
      postId: Id<"schoolClassForumPosts">;
    }
  | {
      kind: "unread";
      offset: number;
      postId: Id<"schoolClassForumPosts">;
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
        name: `forum-ui:${classId}`,
        partialize: (state): PersistedForumState => ({
          savedConversationViews: state.savedConversationViews,
        }),
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      }
    )
  );
