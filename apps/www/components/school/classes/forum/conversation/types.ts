import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";
import type { ForumPost, ReactionWithUsers } from "@/lib/store/forum";

// Re-export ForumPost for convenience
export type { ForumPost } from "@/lib/store/forum";

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
  | { type: "unread"; count: number }
  | {
      type: "post";
      post: ForumPost;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
      showContinuationTime: boolean;
    };
