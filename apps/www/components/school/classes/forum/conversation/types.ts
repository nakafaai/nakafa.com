import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import type {
  ForumConversationView,
  ForumPost,
  ReactionWithUsers,
} from "@/components/school/classes/forum/conversation/store/forum";

// Re-export ForumPost for convenience
export type { ForumPost } from "@/components/school/classes/forum/conversation/store/forum";

/** Represents one forum thread header enriched with user and reaction state. */
export type Forum = Doc<"schoolClassForums"> & {
  user: UserData | null;
  myReactions: string[];
  reactionUsers: ReactionWithUsers[];
};

/** Represents one semantic item rendered in the virtualized forum transcript. */
export type VirtualItem =
  | { type: "header"; forum: Forum }
  | { type: "date"; date: number }
  | {
      type: "unread";
      count: number;
      postId: Id<"schoolClassForumPosts">;
      status: "history" | "new";
    }
  | {
      type: "post";
      post: ForumPost;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
      showContinuationTime: boolean;
    };

export type ConversationTranscriptCommand =
  | {
      id: number;
      kind: "jump";
      postId: Id<"schoolClassForumPosts">;
      smooth: boolean;
    }
  | {
      id: number;
      kind: "latest";
      smooth: boolean;
    }
  | {
      id: number;
      kind: "restore";
      smooth: boolean;
      view: Extract<ForumConversationView, { kind: "post" }>;
    };

export interface ConversationTranscriptCommandResult {
  id: number;
  status: "missing" | "scrolled";
}
