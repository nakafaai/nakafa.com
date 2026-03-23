import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

interface ReactionWithUsers {
  count: number;
  emoji: string;
  reactors: string[];
}

export interface ForumPost extends Doc<"schoolClassForumPosts"> {
  attachments: PostAttachment[];
  myReactions: string[];
  reactionUsers: ReactionWithUsers[];
  replyToUser: UserData | null;
  user: UserData | null;
}

interface ReplyTo {
  postId: Id<"schoolClassForumPosts">;
  userName: string;
}

// Jump mode state for bidirectional pagination
interface JumpModeState {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
  targetIndex: number;
  targetPostId: Id<"schoolClassForumPosts">;
}

type JumpModeStateOrNull = JumpModeState | null;

interface TransientState {
  jumpMode: JumpModeStateOrNull;
}

type State = {
  activeForumId: Id<"schoolClassForums"> | null;
  replyTo: ReplyTo | null;
} & TransientState;

interface Actions {
  appendNewerPosts: (
    posts: ForumPost[],
    hasMore: boolean,
    newestPostId?: Id<"schoolClassForumPosts">
  ) => void;
  appendOlderPosts: (
    posts: ForumPost[],
    hasMore: boolean,
    oldestPostId?: Id<"schoolClassForumPosts">
  ) => void;
  // Jump mode actions
  enterJumpMode: (targetPostId: Id<"schoolClassForumPosts">) => void;
  exitJumpMode: () => void;
  loadNewerPosts: () => void;
  loadOlderPosts: () => void;
  setActiveForumId: (activeForumId: Id<"schoolClassForums"> | null) => void;
  setJumpModeData: (data: {
    posts: ForumPost[];
    targetIndex: number;
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    oldestPostId: Id<"schoolClassForumPosts"> | null;
    newestPostId: Id<"schoolClassForumPosts"> | null;
  }) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type ForumStore = State & Actions;

const initialState: State = {
  activeForumId: null,
  replyTo: null,
  jumpMode: null,
};

/**
 * Creates one transient forum UI store for a single class route subtree.
 */
export const createForumStore = () =>
  createStore<ForumStore>()(
    immer((set, get) => ({
      ...initialState,

      setActiveForumId: (activeForumId) => {
        if (get().activeForumId !== activeForumId) {
          set({ activeForumId, replyTo: null, jumpMode: null });
        }
      },

      setReplyTo: (replyTo) => set({ replyTo }),

      enterJumpMode: (targetPostId) => {
        set({
          jumpMode: {
            targetPostId,
            posts: [],
            targetIndex: 0,
            hasMoreBefore: false,
            hasMoreAfter: false,
            oldestPostId: null,
            newestPostId: null,
            isLoadingOlder: false,
            isLoadingNewer: false,
          },
        });
      },

      exitJumpMode: () => set({ jumpMode: null }),

      setJumpModeData: (data) => {
        const current = get().jumpMode;
        if (current) {
          set({ jumpMode: { ...current, ...data } });
        }
      },

      loadOlderPosts: () => {
        const current = get().jumpMode;
        if (current?.hasMoreBefore && !current.isLoadingOlder) {
          set({ jumpMode: { ...current, isLoadingOlder: true } });
        }
      },

      loadNewerPosts: () => {
        const current = get().jumpMode;
        if (current?.hasMoreAfter && !current.isLoadingNewer) {
          set({ jumpMode: { ...current, isLoadingNewer: true } });
        }
      },

      appendOlderPosts: (posts, hasMore, oldestPostId) => {
        const current = get().jumpMode;
        if (current) {
          set({
            jumpMode: {
              ...current,
              posts: [...posts, ...current.posts],
              targetIndex: current.targetIndex + posts.length,
              hasMoreBefore: hasMore,
              oldestPostId: oldestPostId ?? current.oldestPostId,
              isLoadingOlder: false,
            },
          });
        }
      },

      appendNewerPosts: (posts, hasMore, newestPostId) => {
        const current = get().jumpMode;
        if (current) {
          set({
            jumpMode: {
              ...current,
              posts: [...current.posts, ...posts],
              hasMoreAfter: hasMore,
              newestPostId: newestPostId ?? current.newestPostId,
              isLoadingNewer: false,
            },
          });
        }
      },
    }))
  );
