import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils/posts";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import { createStore } from "zustand";
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

interface State {
  jumpTargetPostId: Id<"schoolClassForumPosts"> | null;
  replyTo: ReplyTo | null;
}

interface Actions {
  enterJumpMode: (targetPostId: Id<"schoolClassForumPosts">) => void;
  exitJumpMode: () => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type ForumStore = State & Actions;

const initialState: State = {
  jumpTargetPostId: null,
  replyTo: null,
};

/**
 * Creates one transient forum UI store for a single class route subtree.
 */
export const createForumStore = () =>
  createStore<ForumStore>()(
    immer((set) => ({
      ...initialState,

      setReplyTo: (replyTo) => set({ replyTo }),

      enterJumpMode: (targetPostId) => set({ jumpTargetPostId: targetPostId }),

      exitJumpMode: () => set({ jumpTargetPostId: null }),
    }))
  );
