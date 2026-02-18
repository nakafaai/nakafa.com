import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import * as z from "zod/mini";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Schema for persisted state validation
const stateSchema = z.object({
  activeForumId: z.nullable(z.string()),
  replyTo: z.nullable(
    z.object({
      postId: z.string(),
      userName: z.string(),
    })
  ),
});

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
  newestTime: number;
  oldestTime: number;
  posts: ForumPost[];
  targetIndex: number;
  targetPostId: Id<"schoolClassForumPosts">;
}

type JumpModeStateOrNull = JumpModeState | null;

interface PersistedState {
  activeForumId: Id<"schoolClassForums"> | null;
  replyTo: ReplyTo | null;
}

interface TransientState {
  jumpMode: JumpModeStateOrNull;
}

type State = PersistedState & TransientState;

interface Actions {
  appendNewerPosts: (
    posts: ForumPost[],
    hasMore: boolean,
    newestTime?: number
  ) => void;
  appendOlderPosts: (
    posts: ForumPost[],
    hasMore: boolean,
    oldestTime?: number
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
    oldestTime: number;
    newestTime: number;
  }) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type ForumStore = State & Actions;

const initialState: State = {
  activeForumId: null,
  replyTo: null,
  jumpMode: null,
};

export const createForumStore = ({
  classId,
}: {
  classId: Id<"schoolClasses">;
}) =>
  createStore<ForumStore>()(
    persist(
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
              oldestTime: 0,
              newestTime: 0,
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

        appendOlderPosts: (posts, hasMore, oldestTime) => {
          const current = get().jumpMode;
          if (current) {
            set({
              jumpMode: {
                ...current,
                posts: [...posts, ...current.posts],
                targetIndex: current.targetIndex + posts.length,
                hasMoreBefore: hasMore,
                oldestTime: oldestTime ?? current.oldestTime,
                isLoadingOlder: false,
              },
            });
          }
        },

        appendNewerPosts: (posts, hasMore, newestTime) => {
          const current = get().jumpMode;
          if (current) {
            set({
              jumpMode: {
                ...current,
                posts: [...current.posts, ...posts],
                hasMoreAfter: hasMore,
                newestTime: newestTime ?? current.newestTime,
                isLoadingNewer: false,
              },
            });
          }
        },
      })),
      {
        name: `nakafa-forum-${classId}`,
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
        partialize: (state) => ({
          activeForumId: state.activeForumId,
          replyTo: state.replyTo,
        }),
        migrate: (persistedState) => parsePersistedState(persistedState),
      }
    )
  );

function parsePersistedState(persisted: unknown): PersistedState {
  const result = z.safeParse(stateSchema, persisted);
  if (!result.success) {
    return { activeForumId: null, replyTo: null };
  }
  return result.data as PersistedState;
}
