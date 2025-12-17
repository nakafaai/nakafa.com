import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/userHelpers";
import type { ForumPost } from "@/lib/store/forum";

// Re-export ForumPost for convenience
export type { ForumPost } from "@/lib/store/forum";

type ReactionWithUsers = {
  emoji: string;
  count: number;
  reactors: string[];
};

export type Forum = Doc<"schoolClassForums"> & {
  user: UserData | null;
  myReactions: string[];
  reactionUsers: ReactionWithUsers[];
};

export type VirtualItem =
  | { type: "header"; forum: Forum }
  | { type: "date"; date: number }
  | { type: "unread"; count: number }
  | { type: "post"; post: ForumPost; isFirstInGroup: boolean }
  | { type: "spacer" };
