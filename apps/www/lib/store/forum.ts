import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils/posts";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

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
  replyTo: ReplyTo | null;
  savedConversationViews: Partial<
    Record<Id<"schoolClassForums">, ForumConversationView>
  >;
}

interface Actions {
  clearTransientConversationState: () => void;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type ForumStore = State & Actions;

const initialState: State = {
  savedConversationViews: {},
  replyTo: null,
};

/** Compares two saved forum conversation views by value. */
function isSameConversationView(
  left: ForumConversationView | undefined,
  right: ForumConversationView | undefined
) {
  if (!(left && right)) {
    return left === right;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "bottom":
      return true;
    case "header":
      if (right.kind !== "header") {
        return false;
      }
      return left.postId === right.postId && left.offset === right.offset;
    case "date":
      if (right.kind !== "date") {
        return false;
      }
      return (
        left.date === right.date &&
        left.postId === right.postId &&
        left.offset === right.offset
      );
    case "unread":
      if (right.kind !== "unread") {
        return false;
      }
      return left.postId === right.postId && left.offset === right.offset;
    case "post":
      if (right.kind !== "post") {
        return false;
      }
      return left.postId === right.postId && left.offset === right.offset;
    default:
      return false;
  }
}

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

        saveConversationView: (forumId, view) => {
          const savedView = get().savedConversationViews[forumId];

          if (isSameConversationView(savedView, view)) {
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
